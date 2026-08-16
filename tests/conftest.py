"""
VisionTrack — Test Configuration and Fixtures

Shared pytest fixtures for all test modules.
"""

import sys
from pathlib import Path

import numpy as np
import pytest

# Ensure project root is importable
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


@pytest.fixture
def blank_frame():
    """A blank 480×640 BGR frame (black, no content)."""
    return np.zeros((480, 640, 3), dtype=np.uint8)


@pytest.fixture
def colored_frame():
    """A 480×640 BGR frame with a gray rectangle (simulates object)."""
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    frame[100:300, 150:450] = [128, 128, 128]  # gray rectangle
    return frame


@pytest.fixture
def sample_detection_array():
    """
    Simulated tracker input array (N, 6): [x1, y1, x2, y2, conf, cls_id]
    Mimics 3 detections: 2 people and 1 car.
    """
    return np.array([
        [100, 50, 200, 250, 0.92, 0],   # person
        [300, 80, 420, 300, 0.87, 0],   # person
        [50,  10, 150, 100, 0.75, 2],   # car
    ], dtype=np.float32)


@pytest.fixture
def sample_tracker_output():
    """
    Simulated ByteTrack output (N, 7): [x1, y1, x2, y2, track_id, cls_id, conf]
    """
    return [
        [100.0, 50.0, 200.0, 250.0, 1, 0, 0.92],
        [300.0, 80.0, 420.0, 300.0, 2, 0, 0.87],
        [50.0,  10.0, 150.0, 100.0, 3, 2, 0.75],
    ]
