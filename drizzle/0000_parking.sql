CREATE TABLE student (id TEXT PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL, phone TEXT, email TEXT, department TEXT NOT NULL, semester INTEGER CHECK (semester BETWEEN 1 AND 8));
--> statement-breakpoint
CREATE TABLE vehicle (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL REFERENCES student(id), plate TEXT NOT NULL UNIQUE, type TEXT NOT NULL CHECK (type IN ('Car','Two-wheeler')), brand TEXT, model TEXT, color TEXT);
--> statement-breakpoint
CREATE TABLE parking_slot (id TEXT PRIMARY KEY, type TEXT NOT NULL CHECK (type IN ('Car','Two-wheeler')), location TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE parking_pass (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL REFERENCES student(id), type TEXT NOT NULL CHECK (type IN ('Semester','Temporary')), issued TEXT NOT NULL, expires TEXT NOT NULL CHECK (expires >= issued));
--> statement-breakpoint
CREATE TABLE parking_record (id INTEGER PRIMARY KEY AUTOINCREMENT, vehicle_id INTEGER NOT NULL REFERENCES vehicle(id), slot_id TEXT NOT NULL REFERENCES parking_slot(id), pass_id INTEGER REFERENCES parking_pass(id), entered TEXT NOT NULL, exited TEXT CHECK (exited >= entered));
--> statement-breakpoint
CREATE UNIQUE INDEX one_open_visit_per_vehicle ON parking_record(vehicle_id) WHERE exited IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX one_active_vehicle_per_slot ON parking_record(slot_id) WHERE exited IS NULL;
--> statement-breakpoint
CREATE INDEX parking_record_entered ON parking_record(entered);
--> statement-breakpoint
CREATE INDEX parking_record_exited ON parking_record(exited);
--> statement-breakpoint
CREATE TABLE configuration (id INTEGER PRIMARY KEY CHECK (id = 1), initialized_at TEXT NOT NULL);
