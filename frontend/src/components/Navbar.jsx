import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

// Changes:
// - Reordered Navbar: Clients, Tasks, Invoices, Logout
// - Made navbar fixed-top and improved styling

const Navbar = () => {
  const token = localStorage.getItem('taskmate_token');
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('taskmate_token');
    navigate('/auth');
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-light" style={{position:'fixed', top:0, width:'100%', zIndex:999}}>
      <div className="container-fluid">
        <Link className="navbar-brand" to="/">
          TaskMate
        </Link>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" 
          data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" 
          aria-label="Toggle navigation">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarSupportedContent">
          <ul className="navbar-nav ms-auto mb-2 mb-lg-0">
            {token && (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/clients">Clients</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/tasks">Tasks</Link>
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
      </div>
    </nav>
  );
};

export default Navbar;
