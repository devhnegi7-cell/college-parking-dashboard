-- Run against a CampusPark SQLite database. UTC timestamps are stored as ISO text.

-- 1. Current slot availability by location and vehicle type.
SELECT s.location, s.type,
       COUNT(*) AS total_slots,
       COUNT(r.id) AS occupied_slots,
       COUNT(*) - COUNT(r.id) AS available_slots
FROM parking_slot AS s
LEFT JOIN parking_record AS r ON r.slot_id = s.id AND r.exited IS NULL
GROUP BY s.location, s.type
ORDER BY s.location, s.type;

-- 2. Vehicles currently on campus and their assigned slots.
SELECT v.plate, st.first_name || ' ' || st.last_name AS student,
       r.slot_id, datetime(r.entered, '+5 hours', '+30 minutes') AS entered_ist
FROM parking_record AS r
JOIN vehicle AS v ON v.id = r.vehicle_id
JOIN student AS st ON st.id = v.student_id
WHERE r.exited IS NULL
ORDER BY r.entered;

-- 3. Campus arrival counts by local hour.
SELECT strftime('%H:00', entered, '+5 hours', '+30 minutes') AS hour_ist,
       COUNT(*) AS arrivals
FROM parking_record
GROUP BY hour_ist
ORDER BY arrivals DESC, hour_ist;

-- 4. Average completed visit length by vehicle type.
SELECT v.type,
       COUNT(*) AS completed_visits,
       ROUND(AVG((julianday(r.exited) - julianday(r.entered)) * 1440), 1) AS avg_minutes
FROM parking_record AS r
JOIN vehicle AS v ON v.id = r.vehicle_id
WHERE r.exited IS NOT NULL
GROUP BY v.type;

-- 5. Active passes due to expire in the next seven days.
SELECT student_id, type, expires
FROM parking_pass
WHERE issued <= date('now', '+5 hours', '+30 minutes')
  AND expires BETWEEN date('now', '+5 hours', '+30 minutes')
                  AND date('now', '+5 hours', '+30 minutes', '+7 days')
ORDER BY expires, student_id;
