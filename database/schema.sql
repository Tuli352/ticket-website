-- Ne-Yo Ticket Sales — MySQL schema
-- Records are intentionally NOT auto-deleted. Sales close automatically
-- after the event window, but orders/payments/tickets persist so you can
-- reconcile, refund, and resolve disputes after the window ends.

CREATE DATABASE IF NOT EXISTS neyo_tickets CHARACTER SET utf8mb4;
USE neyo_tickets;

CREATE TABLE event_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  event_name VARCHAR(255) NOT NULL,
  venue VARCHAR(255) NOT NULL,
  event_date DATETIME NOT NULL,
  sales_open_at DATETIME NOT NULL,
  sales_close_at DATETIME NOT NULL, -- e.g. sales_open_at + 8 hours
  status ENUM('open','closed') NOT NULL DEFAULT 'open'
);

CREATE TABLE ticket_types (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,          -- Regular / VIP / VVIP
  price DECIMAL(10,2) NOT NULL,
  total_quantity INT NOT NULL,
  reserved_quantity INT NOT NULL DEFAULT 0,
  sold_quantity INT NOT NULL DEFAULT 0
);

CREATE TABLE orders (
  id CHAR(36) PRIMARY KEY,             -- UUID, used as payment AccountReference
  customer_name VARCHAR(150) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_email VARCHAR(150) NOT NULL,
  ticket_type_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status ENUM('reserved','pending_payment','paid','failed','expired') NOT NULL DEFAULT 'reserved',
  reserved_until DATETIME NOT NULL,    -- reservation expiry (e.g. 10 min)
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id)
);

CREATE TABLE payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id CHAR(36) NOT NULL,
  method ENUM('mpesa','card','bank') NOT NULL,
  provider_reference VARCHAR(150),     -- MpesaReceiptNumber / card charge id / bank txn ref
  checkout_request_id VARCHAR(150),    -- Daraja CheckoutRequestID (for STK polling)
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('initiated','pending','success','failed') NOT NULL DEFAULT 'initiated',
  raw_callback JSON,                   -- full callback payload, kept for reconciliation
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE tickets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id CHAR(36) NOT NULL,
  ticket_code VARCHAR(40) UNIQUE NOT NULL,
  qr_data TEXT,
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checked_in TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE admins (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(80) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL
);

-- seed example
INSERT INTO event_settings (event_name, venue, event_date, sales_open_at, sales_close_at, status)
VALUES ('Ne-Yo Live', 'TBD Venue, Nairobi', '2026-09-20 19:00:00', NOW(), DATE_ADD(NOW(), INTERVAL 8 HOUR), 'open');

INSERT INTO ticket_types (name, price, total_quantity) VALUES
('Regular', 3000.00, 500),
('VIP', 8000.00, 150),
('VVIP', 15000.00, 50);
