-- PostgreSQL database initialization script

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  email TEXT NOT NULL
);

INSERT INTO users (username, password, email) VALUES
('testuser', 'password123', 'testuser@example.com');