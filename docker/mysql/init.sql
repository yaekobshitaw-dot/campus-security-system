CREATE DATABASE IF NOT EXISTS campus_security;
USE campus_security;

CREATE TABLE IF NOT EXISTS users (
    user_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    role ENUM('student', 'faculty', 'staff', 'security', 'admin') NOT NULL DEFAULT 'student',
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incidents (
    incident_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    status ENUM('reported', 'acknowledged', 'dispatched', 'on_scene', 'resolved', 'closed', 'cancelled') DEFAULT 'reported',
    location_name VARCHAR(255),
    building VARCHAR(100),
    room VARCHAR(50),
    is_anonymous BOOLEAN DEFAULT FALSE,
    is_sos BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

INSERT INTO users (user_id, email, name, role, password_hash, is_active) VALUES
(UUID(), 'test@test.com', 'Test User', 'student', '', TRUE);
