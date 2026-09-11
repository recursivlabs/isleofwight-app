// icongen — renders an icon spec natively at an exact pixel size using Core
// Graphics, i.e. the same rasteriser that draws on device.
//
// Why this exists: exporting one 1024 master and letting something downscale it
// is what makes icons look soft. Every size here is drawn from vector geometry
// at its own pixel dimensions, so nothing is ever resampled.
//
// Output conforms to Apple's app icon requirements: PNG, sRGB, no alpha,
// no embedded layers, square corners (the system applies the mask).

import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// ---------------------------------------------------------------- spec model

struct Spec: Decodable {
    var canvas: Double                 // design-space canvas, e.g. 48
    var background: String?            // nil => transparent
    var tx: Double?                    // translate applied in design space
    var ty: Double?
    var scale: Double?                 // scale applied before translate
    var elements: [Element]
}

struct Element: Decodable {
    var type: String                   // "path" | "rrect" | "ellipse"
    var d: String?                     // path data (type == path)
    var x: Double?, y: Double?, w: Double?, h: Double?, r: Double?
    var fill: String?
    var stroke: String?
    var strokeWidth: Double?
    var cap: String?                   // "round" | "butt"
    var join: String?                  // "round" | "miter"
}

// ------------------------------------------------------------- colour parsing

func colour(_ hex: String) -> CGColor {
    var s = hex.trimmingCharacters(in: .whitespaces)
    if s.hasPrefix("#") { s.removeFirst() }
    if s.count == 6 { s += "FF" }
    let v = UInt32(s, radix: 16) ?? 0
    let space = CGColorSpace(name: CGColorSpace.sRGB)!
    let c: [CGFloat] = [
        CGFloat((v >> 24) & 0xFF) / 255.0,
        CGFloat((v >> 16) & 0xFF) / 255.0,
        CGFloat((v >>  8) & 0xFF) / 255.0,
        CGFloat( v        & 0xFF) / 255.0,
    ]
    return CGColor(colorSpace: space, components: c)!
}

// ------------------------------------------------------ minimal SVG path parser
// Supports the subset this project's marks actually use: M m L l H h V v
// C c S s Z z. Arcs are deliberately unsupported — every shape here is either a
// bezier path or a primitive, and silently mis-drawing an arc would be worse
// than failing loudly.

struct PathParser {
    let src: [Character]
    var i = 0
    init(_ s: String) { src = Array(s) }

    mutating func skip() {
        while i < src.count, src[i] == " " || src[i] == "," || src[i] == "\n" || src[i] == "\t" { i += 1 }
    }
    mutating func number() -> Double? {
        skip()
        var s = ""
        if i < src.count, src[i] == "-" || src[i] == "+" { s.append(src[i]); i += 1 }
        var seenDot = false
        while i < src.count {
            let c = src[i]
            if c.isNumber { s.append(c); i += 1 }
            else if c == "." && !seenDot { seenDot = true; s.append(c); i += 1 }
            else if c == "." && seenDot { break }      // "1.5.5" => two numbers
            else if c == "e" || c == "E" {
                s.append(c); i += 1
                if i < src.count, src[i] == "-" || src[i] == "+" { s.append(src[i]); i += 1 }
            } else { break }
        }
        return s.isEmpty || s == "-" || s == "+" ? nil : Double(s)
    }
    mutating func isCommand() -> Character? {
        skip()
        guard i < src.count else { return nil }
        let c = src[i]
        return "MmLlHhVvCcSsZz".contains(c) ? c : nil
    }

    static func build(_ d: String) -> CGPath {
        let p = CGMutablePath()
        var pp = PathParser(d)
        var cur = CGPoint.zero, start = CGPoint.zero
        var lastCtrl: CGPoint? = nil
        var cmd: Character = "M"

        while true {
            pp.skip()
            if pp.i >= pp.src.count { break }
            if let c = pp.isCommand() { cmd = c; pp.i += 1 }

            let rel = cmd.isLowercase
            switch Character(cmd.lowercased()) {
            case "m":
                guard let x = pp.number(), let y = pp.number() else { break }
                cur = rel ? CGPoint(x: cur.x + x, y: cur.y + y) : CGPoint(x: x, y: y)
                p.move(to: cur); start = cur; lastCtrl = nil
                cmd = rel ? "l" : "L"          // implicit lineto after moveto
            case "l":
                guard let x = pp.number(), let y = pp.number() else { break }
                cur = rel ? CGPoint(x: cur.x + x, y: cur.y + y) : CGPoint(x: x, y: y)
                p.addLine(to: cur); lastCtrl = nil
            case "h":
                guard let x = pp.number() else { break }
                cur = CGPoint(x: rel ? cur.x + x : x, y: cur.y)
                p.addLine(to: cur); lastCtrl = nil
            case "v":
                guard let y = pp.number() else { break }
                cur = CGPoint(x: cur.x, y: rel ? cur.y + y : y)
                p.addLine(to: cur); lastCtrl = nil
            case "c":
                guard let a = pp.number(), let b = pp.number(),
                      let c = pp.number(), let dd = pp.number(),
                      let e = pp.number(), let f = pp.number() else { break }
                let c1 = rel ? CGPoint(x: cur.x + a, y: cur.y + b) : CGPoint(x: a, y: b)
                let c2 = rel ? CGPoint(x: cur.x + c, y: cur.y + dd) : CGPoint(x: c, y: dd)
                let to = rel ? CGPoint(x: cur.x + e, y: cur.y + f) : CGPoint(x: e, y: f)
                p.addCurve(to: to, control1: c1, control2: c2)
                lastCtrl = c2; cur = to
            case "s":
                guard let c = pp.number(), let dd = pp.number(),
                      let e = pp.number(), let f = pp.number() else { break }
                let c1 = lastCtrl.map { CGPoint(x: 2 * cur.x - $0.x, y: 2 * cur.y - $0.y) } ?? cur
                let c2 = rel ? CGPoint(x: cur.x + c, y: cur.y + dd) : CGPoint(x: c, y: dd)
                let to = rel ? CGPoint(x: cur.x + e, y: cur.y + f) : CGPoint(x: e, y: f)
                p.addCurve(to: to, control1: c1, control2: c2)
                lastCtrl = c2; cur = to
            case "z":
                p.closeSubpath(); cur = start; lastCtrl = nil
            default:
                FileHandle.standardError.write("unsupported path command '\(cmd)'\n".data(using: .utf8)!)
                exit(2)
            }
        }
        return p
    }
}

// ------------------------------------------------------------------- rendering

func render(spec: Spec, px: Int, opaque: Bool, to url: URL) {
    let space = CGColorSpace(name: CGColorSpace.sRGB)!
    // Opaque app icons carry no alpha at all — Apple rejects icons with one.
    let info: CGBitmapInfo = opaque
        ? CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue)
        : CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue)

    guard let ctx = CGContext(data: nil, width: px, height: px,
                              bitsPerComponent: 8, bytesPerRow: 0,
                              space: space, bitmapInfo: info.rawValue) else {
        FileHandle.standardError.write("could not create context at \(px)px\n".data(using: .utf8)!)
        exit(1)
    }

    ctx.setShouldAntialias(true)
    ctx.setAllowsAntialiasing(true)
    ctx.interpolationQuality = .high
    ctx.setLineCap(.round)
    ctx.setLineJoin(.round)

    if let bg = spec.background {
        ctx.setFillColor(colour(bg))
        ctx.fill(CGRect(x: 0, y: 0, width: px, height: px))
    } else if opaque {
        ctx.setFillColor(colour("#FFFFFF"))
        ctx.fill(CGRect(x: 0, y: 0, width: px, height: px))
    }

    // design space is y-down (SVG); CG is y-up
    let k = Double(px) / spec.canvas
    ctx.translateBy(x: 0, y: CGFloat(px))
    ctx.scaleBy(x: CGFloat(k), y: CGFloat(-k))
    ctx.translateBy(x: CGFloat(spec.tx ?? 0), y: CGFloat(spec.ty ?? 0))
    if let sc = spec.scale { ctx.scaleBy(x: CGFloat(sc), y: CGFloat(sc)) }

    for e in spec.elements {
        let path: CGPath
        switch e.type {
        case "path":
            path = PathParser.build(e.d ?? "")
        case "rrect":
            let rect = CGRect(x: e.x ?? 0, y: e.y ?? 0, width: e.w ?? 0, height: e.h ?? 0)
            path = CGPath(roundedRect: rect, cornerWidth: CGFloat(e.r ?? 0),
                          cornerHeight: CGFloat(e.r ?? 0), transform: nil)
        case "ellipse":
            path = CGPath(ellipseIn: CGRect(x: e.x ?? 0, y: e.y ?? 0,
                                            width: e.w ?? 0, height: e.h ?? 0), transform: nil)
        default:
            continue
        }

        if let f = e.fill {
            ctx.addPath(path); ctx.setFillColor(colour(f)); ctx.fillPath()
        }
        if let s = e.stroke {
            ctx.setLineCap(e.cap == "butt" ? .butt : .round)
            ctx.setLineJoin(e.join == "miter" ? .miter : .round)
            ctx.addPath(path)
            ctx.setStrokeColor(colour(s))
            ctx.setLineWidth(CGFloat(e.strokeWidth ?? 1))
            ctx.strokePath()
        }
    }

    guard let img = ctx.makeImage(),
          let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
        FileHandle.standardError.write("could not encode \(url.lastPathComponent)\n".data(using: .utf8)!)
        exit(1)
    }
    // 72 dpi, no interlacing — matches what Apple's own tooling emits
    let props: [CFString: Any] = [
        kCGImagePropertyDPIWidth: 72, kCGImagePropertyDPIHeight: 72,
        kCGImagePropertyHasAlpha: !opaque,
    ]
    CGImageDestinationAddImage(dest, img, props as CFDictionary)
    if !CGImageDestinationFinalize(dest) {
        FileHandle.standardError.write("write failed \(url.path)\n".data(using: .utf8)!)
        exit(1)
    }
}

// ----------------------------------------------------------------------- main
// usage: icongen <spec.json> <outdir> <name> <opaque:0|1> <size> [size...]

let args = CommandLine.arguments
guard args.count >= 6 else {
    FileHandle.standardError.write("usage: icongen spec.json outdir name opaque size...\n".data(using: .utf8)!)
    exit(64)
}
let specURL = URL(fileURLWithPath: args[1])
let outDir  = URL(fileURLWithPath: args[2])
let name    = args[3]
let opaque  = args[4] == "1"
let sizes   = args[5...].compactMap { Int($0) }

let spec = try! JSONDecoder().decode(Spec.self, from: Data(contentsOf: specURL))
try? FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

for s in sizes {
    let url = outDir.appendingPathComponent("\(name)-\(s).png")
    render(spec: spec, px: s, opaque: opaque, to: url)
    print("\(url.lastPathComponent)  \(s)x\(s)")
}
