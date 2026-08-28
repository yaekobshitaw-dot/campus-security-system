CREATE DATABASE IF NOT EXISTS campus_security;
USE campus_security;

CREATE TABLE IF NOT EXISTS users (
    user_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    role ENUM('student', 'faculty', 'staff', 'security', 'admin') NOT NULL DEFAULT 'student',
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    push_token VARCHAR(255) NULL,
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    location_updated_at DATETIME NULL,
    availability_status ENUM('available', 'responding', 'busy', 'offline') NOT NULL DEFAULT 'offline',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incidents (
    incident_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    status ENUM('reported', 'investigating', 'resolved', 'acknowledged', 'dispatched', 'on_scene', 'closed', 'cancelled') DEFAULT 'reported',
    location_name VARCHAR(255),
    building VARCHAR(100),
    room VARCHAR(50),
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    is_anonymous BOOLEAN DEFAULT FALSE,
    is_sos BOOLEAN DEFAULT FALSE,
    photos JSON NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);