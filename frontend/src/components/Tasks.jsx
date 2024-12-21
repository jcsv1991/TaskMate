import React, { useEffect, useState } from 'react';
import API from '../services/api';
import { Spinner, Alert, Button } from 'react-bootstrap';

/*
 Changes:
 1. Sorting & filtering have been tested to ensure query parameters pass to GET /tasks.
 2. The list updates immediately on "Apply."
*/

const Tasks = () => {
  const [tasks, setTasks] = useState([]);
  const [formData, setFormData] = useState({ title:'', description:'', dueDate:'', clientName:'' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const [filters, setFilters] = useState({
    completed: '',
    clientName: '',
    sortBy: '',
    order: 'asc'
  });

  const [allClients, setAllClients] = useState([]);
  const [clientSuggestions, setClientSuggestions] = useState([]);

  useEffect(() => {
    applyFilters();
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const res = await API.get('/clients');
    setAllClients(res.data);
  };

  const fetchTasks = async (params) => {
    setLoading(true);
    try {
      const res = await API.get('/tasks', { params });
      setTasks(res.data);
      setError('');
    } catch (err) {
      setError('Error fetching tasks');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    const { completed, clientName, sortBy, order } = filters;
    const requestParams = { completed, clientName, sortBy, order };
    fetchTasks(requestParams);
  };

  useEffect(() => {
    const filtered = allClients.filter(c => c.name.toLowerCase().includes(formData.clientName.toLowerCase()));
    setClientSuggestions(filtered.slice(0,5));
  }, [formData.clientName, allClients]);

  const handleFilterChange = (e) => {
    setFilters({...filters, [e.target.name]: e.target.value});
  };

  const handleFormChange = (e) => {
    setFormData({...formData, [e.target.name]: e.target.value});
  };

  const selectClientSuggestion = (name) => {
    setFormData({...formData, clientName: name});
    setClientSuggestions([]);
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    setAdding(true);
    setError('');

    try {
      let clientId = null;
      if (formData.clientName) {
        const matched = allClients.find(c => c.name.toLowerCase() === formData.clientName.toLowerCase());
        if (matched) {
          clientId = matched._id;
        }
      }
      await API.post('/tasks', {
        title: formData.title,
        description: formData.description,
        dueDate: formData.dueDate,
        clientId
      });
      applyFilters();
      setFormData({ title:'', description:'', dueDate:'', clientName:'' });
    } catch (err) {
      setError('Failed to add task');
    } finally {
      setAdding(false);
    }
  };

  const markCompleted = async (id) => {
    try {
      await API.patch(`/tasks/${id}/completed`);
      applyFilters();
    } catch (err) {
      setError('Failed to mark task as completed');
    }
  };

  const markPending = async (id) => {
    try {
      const found = tasks.find(t => t._id === id);
      if (found && found.completed) {
        await API.put(`/tasks/${id}`, { completed: false });
      }
      applyFilters();
    } catch (err) {
      setError('Failed to set task as pending');
    }
  };

  const deleteTask = async (id) => {
    try {
      await API.delete(`/tasks/${id}`);
      applyFilters();
    } catch (err) {
      setError('Failed to delete task');
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
          <input className="form-control" name="clientName" placeholder="Client Name" value={filters.clientName} onChange={handleFilterChange} />
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

      {loading ? (
        <Spinner animation="border" />
      ) : (
        <ul className="list-group mt-3">
          {tasks.map(task => (
            <li className="list-group-item d-flex justify-content-between align-items-center" key={task._id}>
              <div style={{maxWidth:'70%'}}>
                <strong>{task.title}</strong> - {task.completed ? "Completed" : "Pending"}
                <br/>
                <small>{task.description}</small><br/>
                <small>Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}</small>
              </div>
              <div className="btn-group">
                <Button variant="success" size="sm" onClick={() => markCompleted(task._id)}>Complete</Button>
                <Button variant="warning" size="sm" onClick={() => markPending(task._id)}>Pending</Button>
                <Button variant="danger" size="sm" onClick={() => deleteTask(task._id)}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <hr/>
      <h3>Add a New Task</h3>
      <form onSubmit={handleAddTask} className="mb-4">
        <input className="form-control my-2" name="title" placeholder="Task Title" value={formData.title} onChange={handleFormChange} required />
        <input className="form-control my-2" name="description" placeholder="Task Description" value={formData.description} onChange={handleFormChange} required />
        <input className="form-control my-2" type="date" name="dueDate" value={formData.dueDate} onChange={handleFormChange} required />

        <div className="position-relative my-2">
          <input
            className="form-control"
            name="clientName"
            placeholder="Client Name (optional)"
            value={formData.clientName}
            onChange={handleFormChange}
          />
          {formData.clientName && clientSuggestions.length > 0 && (
            <ul className="list-group position-absolute" style={{width:'100%', zIndex:10}}>
              {clientSuggestions.map(c => (
                <li
                  key={c._id}
                  className="list-group-item"
                  style={{cursor:'pointer'}}
                  onMouseDown={() => selectClientSuggestion(c.name)}
                >
                  {c.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button type="submit" className="btn btn-primary" disabled={adding}>Add Task</button>
      </form>
    </div>
  );
};

export default Tasks;
