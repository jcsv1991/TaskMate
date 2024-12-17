import React, { useState } from 'react';
import Login from '../components/Login';
import Register from '../components/Register';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="container mt-5">
      <h2>{isLogin ? "Login to TaskMate" : "Register for TaskMate"}</h2>
      {isLogin ? <Login /> : <Register />}
      <button
        className="btn btn-link mt-2"
        onClick={() => setIsLogin(!isLogin)}
      >
        {isLogin ? "Need an account? Register" : "Already have an account? Login"}
      </button>
    </div>
  );
};

export default Auth;
