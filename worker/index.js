const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (value, status = 200) => Response.json(value, { status, headers });
const dayAtCampus = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(date);
const iso = () => new Date().toISOString();
const types = ['Car', 'Two-wheeler'];
const passTypes = ['Semester', 'Temporary'];
const plate = value => String(value ?? '').toUpperCase().replace(/[\s-]/g, '');
const clean = (value, max = 80) => String(value ?? '').trim().slice(0, max);
const dateValid = value => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const run = (db, query, ...values) => db.prepare(query).bind(...values);
const row = (db, query, ...values) => run(db, query, ...values).first();

async function initialize(db) {
  if (await row(db, 'SELECT id FROM configuration WHERE id = 1')) return;
  const now = Date.now(), ago = minutes => new Date(now - minutes * 60000).toISOString();
  const date = days => dayAtCampus(new Date(now + days * 86400000));
  const names = [
    ['Aarav','Sharma','Computer Science'], ['Ananya','Gupta','Electronics'],
    ['Rohan','Mehta','Management'], ['Priya','Singh','Computer Science'],
    ['Rahul','Verma','Mathematics'], ['Neha','Jain','Information Technology'],
    ['Kabir','Khanna','Management'], ['Meera','Kapoor','Computer Science'],
    ['Arjun','Rao','Electrical'], ['Diya','Saxena','Electronics'],
    ['Ishaan','Bhatia','Mathematics'], ['Tara','Joshi','Information Technology'],
    ['Vivaan','Sethi','Computer Science'], ['Ira','Patel','Electronics'],
    ['Avni','Nair','Management'], ['Ved','Arora','Mathematics']
  ];
  const groups = new Map();
  const queue = (sql, ...values) => {
    if (!groups.has(sql)) groups.set(sql, []);
    groups.get(sql).push(values);
  };
  const nextSlot = { Car: 0, 'Two-wheeler': 0 };
  for (const [i, [first, last, dept]] of names.entries()) {
    const id = -(i + 1), student = 'DEMO' + String(101+i), kind = types[i % 3 === 0 ? 0 : 1];
    queue('INSERT OR IGNORE INTO student (id, first_name, last_name, department, semester) VALUES (?, ?, ?, ?, ?)', student, first, last, dept, 3);
    queue('INSERT OR IGNORE INTO vehicle (id, student_id, plate, type, brand, model) VALUES (?, ?, ?, ?, ?, ?)',
      id, student, 'DEMO' + String(1001+i), kind, kind === 'Car' ? 'Maruti Suzuki' : 'Honda', kind === 'Car' ? 'Swift' : 'Activa');
    queue('INSERT OR IGNORE INTO parking_pass VALUES (?, ?, ?, ?, ?)',
      id, student, i % 4 ? 'Semester' : 'Temporary', date(-45), date(i === 14 ? -2 : i === 13 ? 3 : 21 + i));
    const zone = kind === 'Car' ? 'A-' : 'C-', slot = zone + String(++nextSlot[kind]).padStart(2, '0');
    if (i < 12) {
      queue('INSERT OR IGNORE INTO parking_record VALUES (?, ?, ?, ?, ?, NULL)', id, id, slot, id, ago(9 + i * 12));
    }
    for (let d = 0; d < 7; d++) {
      const minutesAgo = 160 + (d * 1440) + ((i * 47 + d * 51) % 490);
      const entered = ago(minutesAgo), exited = ago(Math.max(160 + d * 1440, minutesAgo - (31 + (i * 13) % 150)));
      queue('INSERT OR IGNORE INTO parking_record VALUES (?, ?, ?, ?, ?, ?)', -(101 + i * 7 + d), id, slot, id, entered, exited);
    }
  }
  queue('INSERT OR IGNORE INTO configuration VALUES (1, ?)', iso());
  const statements = [];
  for (const [sql, records] of groups) {
    const [prefix, pattern] = sql.split(' VALUES ');
    const size = Math.floor(96 / records[0].length);
    for (let start = 0; start < records.length; start += size) {
      const chunk = records.slice(start, start + size);
      statements.push(run(db, prefix + ' VALUES ' + chunk.map(() => pattern).join(', '), ...chunk.flat()));
    }
  }
  await db.batch(statements);
}

async function snapshot(db) {
  const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
  const results = await db.batch([
    db.prepare('SELECT id, first_name, last_name, department, semester FROM student ORDER BY first_name, last_name'),
    db.prepare('SELECT * FROM vehicle ORDER BY plate'),
    db.prepare('SELECT * FROM parking_slot ORDER BY id'),
    db.prepare('SELECT * FROM parking_pass ORDER BY expires, id'),
    run(db, 'SELECT * FROM parking_record WHERE exited IS NULL OR exited >= ? ORDER BY entered DESC', cutoff)
  ]);
  const [students, vehicles, slots, passes, records] = results.map(result => result.results);
  const date = dayAtCampus();
  return json({ students, vehicles, slots, passes, records, date, updated: iso(), demo: students.some(s => s.id.startsWith('DEMO')) });
}

async function checkIn(db, body) {
  const number = plate(body.plate), slotId = clean(body.slot, 24);
  const found = await row(db, 'SELECT id, student_id, type FROM vehicle WHERE plate = ?', number);
  if (!found) return json({ error: 'This vehicle number is not registered.' }, 404);
  const slot = await row(db, 'SELECT type FROM parking_slot WHERE id = ?', slotId);
  if (!slot || slot.type !== found.type) return json({ error: 'Choose a slot for this vehicle type.' }, 400);
  const date = dayAtCampus();
  const pass = await row(db, 'SELECT id FROM parking_pass WHERE student_id = ? AND issued <= ? AND expires >= ? ORDER BY expires DESC, id DESC LIMIT 1', found.student_id, date, date);
  if (!pass) return json({ error: 'This student does not have a valid parking pass today.' }, 409);
  try {
    await run(db, 'INSERT INTO parking_record (vehicle_id, slot_id, pass_id, entered) VALUES (?, ?, ?, ?)', found.id, slotId, pass.id, iso()).run();
  } catch (error) {
    if (String(error).includes('UNIQUE')) {
      const active = await row(db, 'SELECT id FROM parking_record WHERE vehicle_id = ? AND exited IS NULL', found.id);
      return json({ error: active ? 'This vehicle is already parked.' : 'That slot was just taken. Choose another one.' }, 409);
    }
    throw error;
  }
  return json({ message: 'Vehicle checked in.' }, 201);
}

async function checkOut(db, body) {
  const number = plate(body.plate);
  const result = await run(db, 'UPDATE parking_record SET exited = ? WHERE exited IS NULL AND vehicle_id = (SELECT id FROM vehicle WHERE plate = ?)', iso(), number).run();
  return result.meta.changes ? json({ message: 'Exit recorded. The slot is now available.' })
    : json({ error: 'No open visit was found for this vehicle.' }, 404);
}

async function register(db, body) {
  const number = plate(body.plate), type = body.type;
  const student = clean(body.student, 24).toUpperCase();
  const first = clean(body.first, 50), last = clean(body.last, 50), dept = clean(body.department);
  if (!/^[A-Z0-9]{4,16}$/.test(number) || !types.includes(type) || !/^[A-Z0-9-]{2,24}$/.test(student)) {
    return json({ error: 'Enter a valid vehicle number, type, and student ID.' }, 400);
  }
  const enrolled = await row(db, 'SELECT id FROM student WHERE id = ?', student);
  if (!enrolled && (!first || !last || !dept)) return json({ error: 'Enter the new student’s first name, last name, and department.' }, 400);
  try {
    await db.batch([
      run(db, 'INSERT OR IGNORE INTO student (id, first_name, last_name, department) VALUES (?, ?, ?, ?)', student, first, last, dept),
      run(db, 'INSERT INTO vehicle (student_id, plate, type, brand, model, color) VALUES (?, ?, ?, ?, ?, ?)',
        student, number, type, clean(body.brand) || null, clean(body.model) || null, clean(body.color) || null)
    ]);
  } catch (error) {
    if (String(error).includes('UNIQUE')) return json({ error: 'That vehicle number is already registered.' }, 409);
    throw error;
  }
  return json({ message: 'Vehicle registered.' }, 201);
}

async function issuePass(db, body) {
  const student = clean(body.student, 24).toUpperCase(), expires = clean(body.expires, 10), date = dayAtCampus();
  if (!passTypes.includes(body.type) || !dateValid(expires) || expires < date) {
    return json({ error: 'Choose a pass type and an expiry date of today or later.' }, 400);
  }
  if (!(await row(db, 'SELECT id FROM student WHERE id = ?', student))) return json({ error: 'Register the student’s vehicle first.' }, 404);
  await run(db, 'INSERT INTO parking_pass (student_id, type, issued, expires) VALUES (?, ?, ?, ?)', student, body.type, date, expires).run();
  return json({ message: 'Parking pass issued.' }, 201);
}

async function clearSamples(db) {
  await db.batch([
    db.prepare('DELETE FROM parking_record WHERE id < 0 OR vehicle_id < 0'),
    db.prepare("DELETE FROM parking_pass WHERE id < 0 AND id NOT IN (SELECT pass_id FROM parking_record WHERE pass_id IS NOT NULL)"),
    db.prepare('DELETE FROM vehicle WHERE id < 0 AND id NOT IN (SELECT vehicle_id FROM parking_record)'),
    db.prepare("DELETE FROM student WHERE id GLOB 'DEMO[0-9][0-9][0-9]' AND id NOT IN (SELECT student_id FROM vehicle UNION SELECT student_id FROM parking_pass)")
  ]);
  return json({ message: 'Sample visits and unused sample registrations cleared.' });
}

const handlers = {
  '/api/entry': checkIn, '/api/exit': checkOut, '/api/vehicle': register,
  '/api/pass': issuePass, '/api/clear-samples': clearSamples
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname;
    if (request.method === 'GET') {
      const assets = { '/': [page, 'text/html'], '/design.css': [stylesheet, 'text/css'], '/dashboard.js': [client, 'text/javascript'] };
      if (Object.hasOwn(assets, path)) {
        const [body, type] = assets[path];
        return new Response(body, { headers: { ...headers, 'Content-Type': type + '; charset=utf-8',
          'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'self'; base-uri 'none'; form-action 'self'" } });
      }
    }
    if (!path.startsWith('/api/')) return new Response('Not found', { status: 404 });
    const read = request.method === 'GET' && path === '/api/state';
    const write = request.method === 'POST' && Object.hasOwn(handlers, path);
    if (!read && !write) return json({ error: 'That operation is not available.' }, 404);
    if (write && request.headers.get('Origin') !== url.origin) return json({ error: 'Open the dashboard to make changes.' }, 403);
    if (write && !request.headers.get('Content-Type')?.startsWith('application/json')) return json({ error: 'Provide a JSON request.' }, 415);
    try {
      await initialize(env.DB);
      if (read) return await snapshot(env.DB);
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Provide parking details.' }, 400);
      return await handlers[path](env.DB, body);
    } catch (error) {
      console.error('Parking register request failed', error);
      return json({ error: 'The parking database is unavailable. Try again shortly.' }, 503);
    }
  }
};
