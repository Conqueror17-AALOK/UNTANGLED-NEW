import os
import cv2
import numpy as np

def create_templates(out_dir):
    os.makedirs(out_dir, exist_ok=True)

    # 1. valve_manual: two opposing triangles touching at apex
    img = np.ones((40, 50), dtype=np.uint8) * 255
    pts1 = np.array([[5, 10], [25, 20], [5, 30]], np.int32)
    pts2 = np.array([[45, 10], [25, 20], [45, 30]], np.int32)
    cv2.polylines(img, [pts1, pts2], isClosed=True, color=0, thickness=2)
    cv2.imwrite(os.path.join(out_dir, "valve_manual.png"), img)

    # 2. valve_control: valve + actuator top
    img = np.ones((60, 50), dtype=np.uint8) * 255
    pts1 = np.array([[5, 30], [25, 40], [5, 50]], np.int32)
    pts2 = np.array([[45, 30], [25, 40], [45, 50]], np.int32)
    cv2.polylines(img, [pts1, pts2], isClosed=True, color=0, thickness=2)
    cv2.line(img, (25, 40), (25, 22), color=0, thickness=2)
    cv2.ellipse(img, (25, 20), (14, 10), 0, 180, 360, color=0, thickness=2)
    cv2.line(img, (11, 20), (39, 20), color=0, thickness=2)
    cv2.imwrite(os.path.join(out_dir, "valve_control.png"), img)

    # 3. check_valve: valve with directional line
    img = np.ones((40, 50), dtype=np.uint8) * 255
    pts1 = np.array([[5, 10], [25, 20], [5, 30]], np.int32)
    pts2 = np.array([[45, 10], [25, 20], [45, 30]], np.int32)
    cv2.polylines(img, [pts1, pts2], isClosed=True, color=0, thickness=2)
    cv2.line(img, (12, 12), (12, 28), color=0, thickness=2)
    cv2.imwrite(os.path.join(out_dir, "check_valve.png"), img)

    # 4. safety_valve (PSV): angle valve
    img = np.ones((50, 50), dtype=np.uint8) * 255
    pts1 = np.array([[10, 35], [25, 25], [40, 35]], np.int32)
    cv2.polylines(img, [pts1], isClosed=True, color=0, thickness=2)
    cv2.line(img, (25, 25), (25, 10), color=0, thickness=2)
    cv2.circle(img, (25, 8), 4, color=0, thickness=2)
    cv2.imwrite(os.path.join(out_dir, "safety_valve.png"), img)

    # 5. pump: circle with tangential line
    img = np.ones((60, 60), dtype=np.uint8) * 255
    cv2.circle(img, (30, 30), 22, color=0, thickness=2)
    pts = np.array([[30, 8], [52, 8], [30, 22]], np.int32)
    cv2.polylines(img, [pts], isClosed=True, color=0, thickness=2)
    cv2.imwrite(os.path.join(out_dir, "pump.png"), img)

    # 6. tank: vertical vessel
    img = np.ones((90, 60), dtype=np.uint8) * 255
    cv2.rectangle(img, (10, 15), (50, 75), color=0, thickness=2)
    cv2.ellipse(img, (30, 15), (20, 10), 0, 180, 360, color=0, thickness=2)
    cv2.ellipse(img, (30, 75), (20, 10), 0, 0, 180, color=0, thickness=2)
    cv2.imwrite(os.path.join(out_dir, "tank.png"), img)

    # 7. heat_exchanger: rounded cylinder
    img = np.ones((50, 70), dtype=np.uint8) * 255
    cv2.rectangle(img, (15, 10), (55, 40), color=0, thickness=2)
    cv2.line(img, (25, 10), (25, 40), color=0, thickness=2)
    cv2.line(img, (45, 10), (45, 40), color=0, thickness=2)
    cv2.ellipse(img, (15, 25), (8, 15), 0, 90, 270, color=0, thickness=2)
    cv2.ellipse(img, (55, 25), (8, 15), 0, 270, 90, color=0, thickness=2)
    cv2.imwrite(os.path.join(out_dir, "heat_exchanger.png"), img)

    # 8. filter: Y-strainer / conical filter
    img = np.ones((40, 40), dtype=np.uint8) * 255
    pts = np.array([[5, 8], [35, 20], [5, 32]], np.int32)
    cv2.polylines(img, [pts], isClosed=True, color=0, thickness=2)
    cv2.imwrite(os.path.join(out_dir, "filter.png"), img)

    # 9. compressor: trapezoid
    img = np.ones((50, 60), dtype=np.uint8) * 255
    pts = np.array([[10, 8], [50, 18], [50, 32], [10, 42]], np.int32)
    cv2.polylines(img, [pts], isClosed=True, color=0, thickness=2)
    cv2.imwrite(os.path.join(out_dir, "compressor.png"), img)

    # 10. instrument_bubble: circle with dividing line
    img = np.ones((50, 50), dtype=np.uint8) * 255
    cv2.circle(img, (25, 25), 20, color=0, thickness=2)
    cv2.line(img, (5, 25), (45, 25), color=0, thickness=2)
    cv2.imwrite(os.path.join(out_dir, "instrument_bubble.png"), img)

    print(f"Created 10 symbol templates in {out_dir}")

if __name__ == "__main__":
    create_templates("services/perception/perception/symbols/templates")
