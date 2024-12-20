import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = () => {
  const token = localStorage.getItem('taskmate_token');
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('taskmate_token');
    navigate('/auth');
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-light">
      <div className="container">
        <Link className="navbar-brand" to="/">
          TaskMate
        </Link>
        <ul className="navbar-nav ml-auto">
          {token && (
            <>
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
                <button className="btn btn-link nav-link" onClick={handleLogout}>Logout</button>
              </li>
            </>
          )}
          {!token && (
            <li className="nav-item">
              <Link className="nav-link" to="/auth">Login</Link>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
