"""
Progress Tracker - Replaces tqdm.gather() for frontend progress streaming

This module provides async task tracking with WebSocket progress updates
"""

import asyncio
from typing import Any, Callable, Coroutine, Dict, List, Optional
from datetime import datetime


class ProgressTracker:
    """
    Tracks progress of parallel async tasks and streams updates via WebSocket

    Replaces tqdm.asyncio.tqdm.gather() with WebSocket-aware progress tracking

    Usage:
        tracker = ProgressTracker(ws_manager, job_id, total_tasks=10)

        tasks = [
            tracker.track_task("products", search_products()),
            tracker.track_task("pricing", search_pricing()),
            ...
        ]

        results = await asyncio.gather(*tasks)
    """

    def __init__(
        self,
        ws_manager: Any,
        job_id: str,
        total_tasks: int,
        job_store: Optional[Any] = None,
        stage: str = "processing"
    ):
        """
        Args:
            ws_manager: WebSocket connection manager instance
            job_id: Unique job identifier
            total_tasks: Total number of tasks to track
            job_store: Optional JobStore instance for updating job status
            stage: Stage name (e.g., "research", "discovery", "monitoring")
        """
        self.ws_manager = ws_manager
        self.job_id = job_id
        self.total_tasks = total_tasks
        self.job_store = job_store
        self.stage = stage
        self.completed_tasks = 0
        self.failed_tasks = 0
        self.task_results: Dict[str, Any] = {}
        self.task_errors: Dict[str, str] = {}
        self._lock = asyncio.Lock()

    async def track_task(
        self,
        task_name: str,
        coro: Coroutine,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Any:
        """
        Wrap a coroutine with progress tracking

        Args:
            task_name: Human-readable task name (e.g., "products", "pricing")
            coro: Async coroutine to execute
            metadata: Optional metadata to include in progress updates

        Returns:
            Result of the coroutine execution
        """
        # Send task start event
        await self._send_progress(
            task_name=task_name,
            status="started",
            metadata=metadata
        )

        try:
            # Execute the task
            result = await coro

            # Mark as completed
            async with self._lock:
                self.completed_tasks += 1
                self.task_results[task_name] = result

            # Send completion event
            await self._send_progress(
                task_name=task_name,
                status="completed",
                metadata=metadata
            )

            return result

        except Exception as e:
            # Mark as failed
            async with self._lock:
                self.failed_tasks += 1
                self.task_errors[task_name] = str(e)

            # Send failure event
            await self._send_progress(
                task_name=task_name,
                status="failed",
                error=str(e),
                metadata=metadata
            )

            # Re-raise to preserve error handling
            raise

    async def _send_progress(
        self,
        task_name: str,
        status: str,
        error: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Send progress update via WebSocket"""
        progress = self.completed_tasks / self.total_tasks if self.total_tasks > 0 else 0.0

        message = {
            "type": "progress",
            "stage": self.stage,
            "task": task_name,
            "status": status,
            "progress": progress,
            "completed": self.completed_tasks,
            "total": self.total_tasks,
            "failed": self.failed_tasks,
            "timestamp": datetime.now().isoformat()
        }

        if error:
            message["error"] = error

        if metadata:
            message["metadata"] = metadata

        # Send via WebSocket
        await self.ws_manager.send_progress(self.job_id, message)

        # Update job store if available
        if self.job_store:
            self.job_store.update_job(
                self.job_id,
                progress=progress,
                current_step=f"{self.stage}: {task_name} - {status}"
            )

    async def gather(self, *tasks_with_names: tuple) -> List[Any]:
        """
        Gather multiple tracked tasks (alternative API)

        Args:
            tasks_with_names: Tuples of (task_name, coroutine)

        Returns:
            List of results in order

        Usage:
            tracker = ProgressTracker(ws_manager, job_id, total_tasks=3)
            results = await tracker.gather(
                ("products", search_products()),
                ("pricing", search_pricing()),
                ("customers", search_customers())
            )
        """
        tracked_tasks = [
            self.track_task(name, coro)
            for name, coro in tasks_with_names
        ]
        return await asyncio.gather(*tracked_tasks)

    def get_summary(self) -> Dict[str, Any]:
        """Get summary of tracked tasks"""
        return {
            "total_tasks": self.total_tasks,
            "completed_tasks": self.completed_tasks,
            "failed_tasks": self.failed_tasks,
            "success_rate": self.completed_tasks / self.total_tasks if self.total_tasks > 0 else 0.0,
            "task_errors": self.task_errors,
            "stage": self.stage
        }


class MultiStageProgressTracker:
    """
    Tracks progress across multiple stages of a job

    Usage:
        tracker = MultiStageProgressTracker(ws_manager, job_id, job_store)

        # Stage 1: Research
        research_tracker = tracker.stage("research", total_tasks=10)
        research_results = await asyncio.gather(*[
            research_tracker.track_task(name, coro)
            for name, coro in research_tasks
        ])

        # Stage 2: Discovery
        discovery_tracker = tracker.stage("discovery", total_tasks=3)
        discovery_results = await asyncio.gather(*[
            discovery_tracker.track_task(name, coro)
            for name, coro in discovery_tasks
        ])
    """

    def __init__(
        self,
        ws_manager: Any,
        job_id: str,
        job_store: Optional[Any] = None
    ):
        self.ws_manager = ws_manager
        self.job_id = job_id
        self.job_store = job_store
        self.stages: Dict[str, ProgressTracker] = {}
        self.current_stage: Optional[str] = None

    def stage(self, stage_name: str, total_tasks: int) -> ProgressTracker:
        """
        Create a new stage tracker

        Args:
            stage_name: Name of the stage (e.g., "research", "discovery")
            total_tasks: Number of tasks in this stage

        Returns:
            ProgressTracker for this stage
        """
        tracker = ProgressTracker(
            ws_manager=self.ws_manager,
            job_id=self.job_id,
            total_tasks=total_tasks,
            job_store=self.job_store,
            stage=stage_name
        )
        self.stages[stage_name] = tracker
        self.current_stage = stage_name
        return tracker

    def get_overall_progress(self) -> float:
        """Calculate overall progress across all stages"""
        if not self.stages:
            return 0.0

        total_progress = sum(
            tracker.completed_tasks / tracker.total_tasks
            for tracker in self.stages.values()
            if tracker.total_tasks > 0
        )

        return total_progress / len(self.stages)

    def get_summary(self) -> Dict[str, Any]:
        """Get summary of all stages"""
        return {
            "overall_progress": self.get_overall_progress(),
            "current_stage": self.current_stage,
            "stages": {
                name: tracker.get_summary()
                for name, tracker in self.stages.items()
            }
        }
