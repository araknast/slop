import mysql from 'mysql2/promise';
import { config } from '../config.js';

export const pool = mysql.createPool({
  uri: config.mysqlUrl,
  connectionLimit: 10,
  dateStrings: false,
  supportBigNumbers: true,
  bigNumberStrings: false,
});
