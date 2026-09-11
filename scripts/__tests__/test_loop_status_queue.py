import importlib.util
import pathlib
import unittest


MODULE_PATH = pathlib.Path(__file__).parents[1] / "loop-status-queue.py"
SPEC = importlib.util.spec_from_file_location("loop_status_queue", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


def task(
    task_id,
    title,
    score,
    *,
    layer="core",
    status="pending",
    owner=None,
    blocked_by=None,
    release_reason=None,
    context_handoff=None,
):
    return {
        "id": task_id,
        "title": title,
        "score": score,
        "layer": layer,
        "status": status,
        "owner": owner,
        "blocked_by": blocked_by or [],
        "release_reason": release_reason,
        "context_handoff": context_handoff,
    }


class LoopStatusQueueTest(unittest.TestCase):
    def test_additional_launch_tasks_are_portfolio_work_not_duplicate_ladders(self):
        canonical = [
            task(f"minds-ladder-p{i}", f"Gate {i}", 100 - i, layer="launch-ladder")
            for i in range(27)
        ]
        extra = task("proj-for-you", "Improve For You", 186, layer="launch-ladder", owner="jack")
        output = MODULE.render_status(canonical + [extra], canonical + [extra], [])
        self.assertIn("27 canonical rows", output)
        self.assertIn("1 additional launch-layer portfolio task", output)
        self.assertNotIn("DUPLICATE WORK", output)
        self.assertIn("OWNER-RESERVED", output)

    def test_available_list_crosses_layers_and_excludes_claimed_blocked_and_owned(self):
        available = task("growth-email", "Reignite email", 96, layer="growth")
        claimed = task("core-auth", "Fix auth", 200)
        blocked = task("security-rls", "Prove RLS", 190, blocked_by=["migration"])
        owned = task("boost-v2", "Boost v2", 188, owner="jack")
        claim = {"task_id": claimed["id"], "status": "claimed", "agent": "bill", "last_heartbeat": "now"}
        output = MODULE.render_status([], [available, claimed, blocked, owned], [claim])
        available_section = output.split("AVAILABLE NOW", 1)[1].split("OWNER-RESERVED", 1)[0]
        self.assertIn("growth-email", available_section)
        self.assertNotIn("core-auth", available_section)
        self.assertNotIn("security-rls", available_section)
        self.assertIn("boost-v2", output.split("OWNER-RESERVED", 1)[1])
        self.assertIn("ACTIVE CLAIMS 1", output)

    def test_normalized_duplicate_titles_are_quarantined_across_layers(self):
        canonical = task("minds-ladder-p4", "Wire staging", 198, layer="launch-ladder")
        duplicate = task("proj-p4-copy", "Wire: staging!", 300, layer="ops")
        output = MODULE.render_status([canonical], [canonical, duplicate], [])
        self.assertIn("DUPLICATE WORK", output)
        available_section = output.split("AVAILABLE NOW", 1)[1]
        self.assertNotIn("proj-p4-copy", available_section)

    def test_pending_row_released_needs_human_is_not_available(self):
        released = task(
            "repo-split",
            "Publish packages",
            500,
            release_reason="needs_human",
            context_handoff="Human must add an npm token.",
        )
        available = task("safe-work", "Safe work", 10)
        output = MODULE.render_status([], [released, available], [])
        available_section = output.split("AVAILABLE NOW", 1)[1].split("RELEASED WITH BLOCKER", 1)[0]
        self.assertIn("safe-work", available_section)
        self.assertNotIn("repo-split", available_section)
        self.assertIn("reason=needs_human", output)
        self.assertIn("Human must add an npm token", output)

    def test_completed_release_is_verification_work_not_available_or_anomalous(self):
        current = task(
            "completed-current",
            "Current completed handoff",
            100,
            status="in_progress",
            release_reason="completed",
            context_handoff="PR and SHA are ready for a different verifier.",
        )
        legacy = task(
            "completed-legacy",
            "Legacy completed handoff",
            90,
            status="pending",
            release_reason="completed",
        )
        anomaly = task("orphan", "Unexplained in-progress row", 80, status="in_progress")

        output = MODULE.render_status([], [current, legacy, anomaly], [])
        available_section = output.split("AVAILABLE NOW", 1)[1].split("VERIFICATION QUEUE", 1)[0]
        verification_section = output.split("VERIFICATION QUEUE", 1)[1].split(
            "IN-PROGRESS WITHOUT ACTIVE CLAIM", 1
        )[0]
        anomaly_section = output.split("IN-PROGRESS WITHOUT ACTIVE CLAIM", 1)[1]

        self.assertNotIn("completed-current", available_section)
        self.assertNotIn("completed-legacy", available_section)
        self.assertIn("completed-current", verification_section)
        self.assertIn("completed-legacy", verification_section)
        self.assertIn("PR and SHA are ready", verification_section)
        self.assertNotIn("orphan", verification_section)
        self.assertIn("orphan", anomaly_section)
        self.assertNotIn("completed-current", anomaly_section)


if __name__ == "__main__":
    unittest.main()
