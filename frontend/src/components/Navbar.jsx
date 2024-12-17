import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => (
  <nav className="navbar navbar-expand-lg navbar-light bg-light">
    <div className="container">
      <Link className="navbar-brand" to="/">
        TaskMate
      </Link>
      <ul className="navbar-nav ml-auto">
        <li className="nav-item">
          <Link className="nav-link" to="/tasks">Tasks</Link>
        </li>
        <li className="nav-item">
          <Link className="nav-link" to="/clients">Clients</Link>
        </li>
        <li className="nav-item">
          <Link className="nav-link" to="/invoices">Invoices</Link>
        </li>
        <li className="nav-item">
          <Link className="nav-link" to="/auth">Login</Link>
        </li>
      </ul>
    </div>
  </nav>
);

export default Navbar;
