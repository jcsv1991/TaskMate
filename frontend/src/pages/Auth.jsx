import React, { useState } from 'react';
import Login from '../components/Login';
import Register from '../components/Register';
import { Button } from 'react-bootstrap';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="container mt-5">
      <h2>{isLogin ? "Login to TaskMate" : "Register for TaskMate"}</h2>
      {isLogin ? <Login /> : <Register />}
      <Button variant="link" className="mt-2" onClick={() => setIsLogin(!isLogin)}>
        {isLogin ? "Need an account? Register" : "Already have an account? Login"}
      </Button>
    </div>
  );
};

export default Auth;
