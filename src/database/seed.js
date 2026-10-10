export const seedDatabase = (db) => {
  db.run(`
    INSERT INTO crew
    (name, role, status, sector)
    VALUES
    ('Alice', 'Engineer', 'Active', 'A'),
    ('Bob', 'Scientist', 'Injured', 'B'),
    ('Charlie', 'Security', 'Active', 'C'),
    ('Emma', 'Engineer', 'Active', 'B');
  `);

  db.run(`
    INSERT INTO modules
    (module_name, oxygen_level, power_level, status)
    VALUES
    ('Engineering', 95, 80, 'Normal'),
    ('Habitation', 70, 90, 'Warning'),
    ('Medical', 100, 75, 'Normal'),
    ('Reactor', 100, 60, 'Critical');
  `);

  db.run(`
    INSERT INTO supplies
    (item_name, quantity, location)
    VALUES
    ('Food Pack', 200, 'Storage A'),
    ('Water', 500, 'Storage B'),
    ('Medical Kit', 50, 'Medical'),
    ('Protein Gel', 150, 'Storage C');
  `);
};