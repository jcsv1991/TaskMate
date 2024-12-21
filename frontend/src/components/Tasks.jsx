import React, { useEffect, useState } from 'react';
import API from '../services/api';
import { Spinner, Alert } from 'react-bootstrap';

// Changes:
// - Added display of due dates
// - Added toggling tasks between completed and pending
// - Added filters (clientId, completed state, due date filters, sorting)

const Tasks = () => {
  const [tasks, setTasks] = useState([]);
  const [formData, setFormData] = useState({ title:'', description:'', dueDate:'', clientId:'' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const [filters, setFilters] = useState({
    completed: '',
    clientId: '',
    dueBefore: '',
    dueAfter: '',
    sortBy: '',
    order: 'asc'
  });

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await API.get('/tasks', { params: { ...filters } });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    setFormData({...formData, [e.target.name]: e.target.value});
  };

  const handleFilterChange = (e) => {
    setFilters({...filters, [e.target.name]: e.target.value});
  };

  const applyFilters = () => {
    fetchTasks();
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await API.post('/tasks', formData);
      await fetchTasks();
      setFormData({ title:'', description:'', dueDate:'', clientId:'' });
    } catch (err) {
      setError('Failed to add task');
    } finally {
      setAdding(false);
    }
  };

  const toggleTask = async (id) => {
    try {
      await API.put(`/tasks/${id}/toggle`);
      fetchTasks();
    } catch (err) {
      setError('Failed to toggle task state');
    }
  };

  return (
    <div className="container mt-5" style={{paddingTop:'60px'}}>
      <h2>Tasks</h2>
      {error && <Alert variant="danger">{error}</Alert>}

      <div className="row g-2 mb-3">
        <div className="col">
          <select className="form-select" name="completed" value={filters.completed} onChange={handleFilterChange}>
            <option value="">All</option>
            <option value="true">Completed</option>
            <option value="false">Pending</option>
          </select>
        </div>
        <div className="col">
          <input className="form-control" name="clientId" placeholder="Client ID" value={filters.clientId} onChange={handleFilterChange} />
        </div>
        <div className="col">
          <input className="form-control" name="dueBefore" placeholder="Due Before (YYYY-MM-DD)" value={filters.dueBefore} onChange={handleFilterChange} />
        </div>
        <div className="col">
          <input className="form-control" name="dueAfter" placeholder="Due After (YYYY-MM-DD)" value={filters.dueAfter} onChange={handleFilterChange} />
        </div>
        <div className="col">
          <select className="form-select" name="sortBy" value={filters.sortBy} onChange={handleFilterChange}>
            <option value="">No Sort</option>
            <option value="dueDate">Due Date</option>
            <option value="title">Title</option>
          </select>
        </div>
        <div className="col">
          <select className="form-select" name="order" value={filters.order} onChange={handleFilterChange}>
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
        </div>
        <div className="col">
          <button className="btn btn-primary w-100" onClick={applyFilters}>Apply</button>
        </div>
      </div>

      {loading ? <Spinner animation="border" /> : (
        <ul className="list-group mt-3">
          {tasks.map((task) => (
            <li className="list-group-item d-flex justify-content-between align-items-center" key={task._id}>
              <div style={{maxWidth:'70%'}}>
                <strong>{task.title}</strong> - {task.completed ? "Completed" : "Pending"}
                <br/>
                <small>{task.description}</small><br/>
                <small>Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}</small>
              </div>
              <button className="btn btn-sm btn-info" onClick={() => toggleTask(task._id)}>
                {task.completed ? "Mark Pending" : "Mark Complete"}
              </button>
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
        <input className="form-control my-2" name="clientId" placeholder="Client ID (optional)" value={formData.clientId} onChange={handleChange} />
        <button type="submit" className="btn btn-primary" disabled={adding}>Add Task</button>
      </form>
    </div>
  );
};

export default Tasks;
