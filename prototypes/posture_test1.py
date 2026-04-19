# posture_tracker.py

import cv2
import mediapipe as mp
import math
import argparse
import sys

def track_posture(source=0,
                  side_thresh=10.0,
                  forward_thresh=10.0,
                  smoothing_alpha=0.2):
    """
    Launches the posture tracker:
      - side-lean detection in the image plane (X–Y)
      - forward-hunch detection in the sagittal plane (Y–Z)
      - press 'c' to calibrate your neutral forward position
      - press ESC to quit
    """
    # ---- MediaPipe setup ----
    mp_pose    = mp.solutions.pose
    mp_drawing = mp.solutions.drawing_utils
    pose = mp_pose.Pose(
        static_image_mode=False,
        model_complexity=2,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )

    # ---- Video capture ----
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        print(f"[ERROR] Cannot open video source: {source}")
        return

    print("Instructions:") 
    print("  - Press 'C' to calibrate neutral (stand upright).")
    print("  - Press ESC to exit.\n")

    baseline_forward = 0.0
    ema_forward     = 0.0
    calibrated      = False

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # flip horizontally if using webcam for a mirror view
        if isinstance(source, int):
            frame = cv2.flip(frame, 1)

        img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose.process(img_rgb)

        if results.pose_landmarks:
            lm = results.pose_landmarks.landmark
            
            # draw skeleton
            mp_drawing.draw_landmarks(frame, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)

            # --- SIDE TILT (X–Y plane) ---
            # mid shoulders & hips
            l_sh = lm[mp_pose.PoseLandmark.LEFT_SHOULDER.value]
            r_sh = lm[mp_pose.PoseLandmark.RIGHT_SHOULDER.value]
            l_hp = lm[mp_pose.PoseLandmark.LEFT_HIP.value]
            r_hp = lm[mp_pose.PoseLandmark.RIGHT_HIP.value]

            mid_sh = ((l_sh.x + r_sh.x) / 2, (l_sh.y + r_sh.y) / 2)
            mid_hp = ((l_hp.x + r_hp.x) / 2, (l_hp.y + r_hp.y) / 2)

            vec_xy = (mid_sh[0] - mid_hp[0], mid_sh[1] - mid_hp[1])
            angle_side = abs(math.degrees(math.atan2(vec_xy[0], vec_xy[1])))

            # --- FORWARD HUNCH (Y–Z plane) ---
            sh_z = (l_sh.z + r_sh.z) / 2
            hp_z = (l_hp.z + r_hp.z) / 2
            vec_y = mid_sh[1] - mid_hp[1]
            vec_z = sh_z - hp_z
            angle_forward = abs(math.degrees(math.atan2(vec_z, vec_y)))

            # --- CALIBRATION ---
            # If not yet calibrated, we still show raw forward angle
            # Once user presses 'c', we record baseline_forward
            adjusted_forward = angle_forward - baseline_forward if calibrated else angle_forward

            # --- SMOOTH FORWARD ---
            ema_forward = (smoothing_alpha * adjusted_forward +
                           (1 - smoothing_alpha) * ema_forward)

            # --- DRAW ANNOTATIONS ---
            # Side tilt
            col_side = (0,255,0) if angle_side < side_thresh else (0,0,255)
            cv2.putText(frame,
                        f"Tilt (side): {angle_side:5.1f}°",
                        (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, col_side, 2)

            # Forward hunch
            col_fwd = (0,255,0) if ema_forward < forward_thresh else (0,0,255)
            cv2.putText(frame,
                        f"Hunch (fwd): {ema_forward:5.1f}°",
                        (10, 70),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, col_fwd, 2)

        cv2.imshow("Posture Tracker", frame)

        key = cv2.waitKey(1) & 0xFF
        if key == 27:  # ESC
            break
        elif key == ord('c') and results.pose_landmarks:
            # capture current forward angle as baseline
            baseline_forward = angle_forward
            calibrated = True
            print(f"[Calibrated] Baseline forward angle = {baseline_forward:.2f}°")

    cap.release()
    cv2.destroyAllWindows()
    pose.close()

def parse_args():
    p = argparse.ArgumentParser(description="MediaPipe Posture Tracker")
    p.add_argument(
        "--source", "-s",
        default="0",
        help="Camera index (0,1,…) or path to video file"
    )
    return p.parse_args()

if __name__ == "__main__":
    args = parse_args()
    src = int(args.source) if args.source.isdigit() else args.source
    track_posture(src)
