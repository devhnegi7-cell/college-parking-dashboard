-- Preserve existing slot IDs and add capacity for both campus areas.
WITH RECURSIVE
  slot_numbers(n) AS (
    SELECT 1
    UNION ALL
    SELECT n + 1 FROM slot_numbers WHERE n < 60
  ),
  areas(prefix, slots, vehicle_type, location) AS (
    VALUES
      ('A', 30, 'Car', 'Main Gate'),
      ('B', 20, 'Car', 'Academic Block'),
      ('C', 60, 'Two-wheeler', 'Main Gate'),
      ('D', 40, 'Two-wheeler', 'Academic Block')
  )
INSERT OR IGNORE INTO parking_slot (id, type, location)
SELECT prefix || printf('-%02d', n), vehicle_type, location
FROM areas JOIN slot_numbers ON n <= slots;
