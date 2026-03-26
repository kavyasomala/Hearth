import { useSensor, useSensors } from '@dnd-kit/core';
import { PointerSensor, TouchSensor, KeyboardSensor } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

/**
 * useDragSensors
 *
 * Proper custom hook replacing the old DRAG_SENSORS() function call pattern,
 * which technically violated React's rules of hooks.
 *
 * Uses:
 * - PointerSensor: 8px movement threshold to prevent drag stealing tap events
 * - TouchSensor: 120ms delay + 6px tolerance for mobile long-press drag
 * - KeyboardSensor: accessibility keyboard dragging
 */
const useDragSensors = () => {
  return useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
};

export default useDragSensors;
