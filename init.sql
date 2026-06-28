CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT
);

CREATE TABLE faq (
    id SERIAL PRIMARY KEY,
    question TEXT,
    answer TEXT,
    variations TEXT,
    answers TEXT
);

CREATE TABLE logs (
    id SERIAL PRIMARY KEY,
    message TEXT,
    response TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);