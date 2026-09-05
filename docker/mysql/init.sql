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
    phone VARCHAR(32) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sms_messages (
    sms_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    sender_user_id CHAR(36) NOT NULL,
    recipient_user_id CHAR(36) NOT NULL,
    recipient_phone VARCHAR(32) NOT NULL,
    message TEXT NOT NULL,
    status ENUM('queued', 'sent', 'failed', 'delivered', 'expired') NOT NULL DEFAULT 'queued',
    provider VARCHAR(50) NULL,
    error_message TEXT NULL,
    sent_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_user_id) REFERENCES users(user_id),
    FOREIGN KEY (recipient_user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS incidents (
    incident_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    status ENUM('reported', 'investigating', 'resolved', 'acknowledged', 'dispatched', 'on_scene', 'closed', 'cancelled') DEFAULT 'reported',
    location_name VARCHAR(255),
    building VARCHAR(100),
    room VARCHAR(50),
    floor VARCHAR(20),
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    is_anonymous BOOLEAN DEFAULT FALSE,
    is_sos BOOLEAN DEFAULT FALSE,
    photos JSON NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);