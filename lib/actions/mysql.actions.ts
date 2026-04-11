import mysql, { Pool } from "mysql2/promise";

export const pool: Pool =
	(globalThis as any).__mofPool ??
	mysql.createPool({
		host: process.env.MYSQL_HOST,
		user: process.env.MYSQL_USER,
		password: process.env.MYSQL_PASSWORD,
		database: process.env.MYSQL_DATABASE,
		port: Number(process.env.MYSQL_PORT),
		waitForConnections: true,
		connectionLimit: 10,
		queueLimit: 0,
	});

(globalThis as any).__mofPool = pool;