// TaskDetail.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import API from '../services/api';
import { Alert } from 'react-bootstrap';

const TaskDetail = () => {
  const { id } = useParams();
  const [task, setTask] = useState(null);
  const [error, setError] = useState('');

  const fetchTask = async () => {
    try {
      const res = await API.get(`/tasks/${id}`);
      setTask(res.data);
    } catch (err) {
      setError('Failed to load task details');
    }
  };

  useEffect(() => {
    fetchTask();
  }, [id]);

  if (error) return <div className="container mt-5"><Alert variant="danger">{error}</Alert></div>;
  if (!task) return <div className="container mt-5">Loading...</div>;

  return (
    <div className="container mt-5">
      <h2>Task Details</h2>
      <p><strong>Title:</strong> {task.title}</p>
      <p><strong>Description:</strong> {task.description}</p>
      <p><strong>Due Date:</strong> {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}</p>
      <p><strong>Status:</strong> {task.completed ? 'Completed' : 'Pending'}</p>
    </div>
  );
};

export default TaskDetail;
