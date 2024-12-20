import React, { useEffect, useState } from 'react';
import API from '../services/api';
import { Spinner, Alert } from 'react-bootstrap';

const Tasks = () => {
  const [tasks, setTasks] = useState([]);
  const [formData, setFormData] = useState({ title:'', description:'', dueDate:'' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await API.get('/tasks');
      setTasks(res.data);
      setError('');
    } catch (err) {
      setError('Error fetching tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleChange = (e) => {
    setFormData({...formData, [e.target.name]: e.target.value});
  }

  const handleAddTask = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await API.post('/tasks', formData);
      await fetchTasks();
      setFormData({ title:'', description:'', dueDate:'' });
    } catch (err) {
      setError('Failed to add task');
    } finally {
      setAdding(false);
    }
  }

  const markCompleted = async (id) => {
    try {
      await API.patch(`/tasks/${id}/completed`);
      fetchTasks();
    } catch (err) {
      setError('Failed to mark task as completed');
    }
  }

  return (
    <div className="container mt-4">
      <h2>Your Tasks</h2>
      {error && <Alert variant="danger">{error}</Alert>}
      {loading ? <Spinner animation="border" /> : (
        <ul className="list-group mt-3">
          {tasks.map((task) => (
            <li className="list-group-item d-flex justify-content-between align-items-center" key={task._id}>
              <div>
                <strong>{task.title}</strong> - {task.completed ? "Completed" : "Pending"}
                <br/>
                <small>{task.description}</small>
              </div>
              {!task.completed && <button className="btn btn-sm btn-success" onClick={() => markCompleted(task._id)}>Mark Complete</button>}
            </li>
          ))}
        </ul>
      )}

      <hr/>
      <h3>Add a New Task</h3>
      <form onSubmit={handleAddTask} className="mb-4">
        <input className="form-control my-2" name="title" placeholder="Task Title" value={formData.title} onChange={handleChange} required />
        <input className="form-control my-2" name="description" placeholder="Task Description" value={formData.description} onChange={handleChange} required />
        <input className="form-control my-2" type="date" name="dueDate" value={formData.dueDate} onChange={handleChange} required />
        <button type="submit" className="btn btn-primary" disabled={adding}>Add Task</button>
      </form>
    </div>
  );
};

export default Tasks;
