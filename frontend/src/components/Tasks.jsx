// src/components/Tasks.jsx
import React, { useEffect, useState } from 'react';
import API from '../services/api';
import { Spinner, Alert, Button } from 'react-bootstrap';

const Tasks = () => {
  const [tasks, setTasks] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    clientName: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    completed: '',
    clientName: '',
    sortBy: '',
    order: 'asc'
  });

  // Client suggestions for the add-task form
  const [allClients, setAllClients] = useState([]);
  const [clientSuggestions, setClientSuggestions] = useState([]);

  useEffect(() => {
    fetchTasks(filters);
    fetchClients();
  }, []);

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

  const fetchClients = async () => {
    const res = await API.get('/clients');
    setAllClients(res.data);
  };

  // Refilter suggestions when user changes clientName in the form
  useEffect(() => {
    const filtered = allClients.filter((c) =>
      c.name.toLowerCase().includes(formData.clientName.toLowerCase())
    );
    setClientSuggestions(filtered.slice(0, 5));
  }, [formData.clientName, allClients]);

  // On "Apply" filters/sorting
  const applyFilters = () => {
    const { completed, clientName, sortBy, order } = filters;
    fetchTasks({ completed, clientName, sortBy, order });
  };

  // Handle form changes
  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const selectClientSuggestion = (name) => {
    setFormData({ ...formData, clientName: name });
    setClientSuggestions([]);
  };

  // Add a new task
  const handleAddTask = async (e) => {
    e.preventDefault();
    setAdding(true);
    setError('');

    try {
      let clientId = null;
      // Attempt to match the client name
      if (formData.clientName) {
        const matched = allClients.find(
          (c) => c.name.toLowerCase() === formData.clientName.toLowerCase()
        );
        if (matched) clientId = matched._id;
      }
      await API.post('/tasks', {
        title: formData.title,
        description: formData.description,
        dueDate: formData.dueDate,
        clientId
      });
      // Refresh tasks with current filters
      applyFilters();
      setFormData({
        title: '',
        description: '',
        dueDate: '',
        clientName: ''
      });
    } catch (err) {
      setError('Failed to add task');
    } finally {
      setAdding(false);
    }
  };

  // Completion/Pending toggles
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
      const foundTask = tasks.find((t) => t._id === id);
      if (foundTask?.completed) {
        // If it is completed, revert to pending
        await API.put(`/tasks/${id}`, { completed: false });
        applyFilters();
      } else {
        // Already pending => do nothing
      }
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

  // Render
  return (
    <div className="container mt-5" style={{ paddingTop: '60px' }}>
      <h2>Tasks</h2>
      {error && <Alert variant="danger">{error}</Alert>}

      {/* Filter/Sort */}
      <div className="row g-2 mb-3">
        <div className="col">
          <select
            className="form-select"
            name="completed"
            value={filters.completed}
            onChange={handleFilterChange}
          >
            <option value="">All</option>
            <option value="true">Completed</option>
            <option value="false">Pending</option>
          </select>
        </div>
        <div className="col">
          <input
            className="form-control"
            name="clientName"
            placeholder="Client Name"
            value={filters.clientName}
            onChange={handleFilterChange}
          />
        </div>
        <div className="col">
          <select
            className="form-select"
            name="sortBy"
            value={filters.sortBy}
            onChange={handleFilterChange}
          >
            <option value="">No Sort</option>
            <option value="dueDate">Due Date</option>
            <option value="title">Title</option>
          </select>
        </div>
        <div className="col">
          <select
            className="form-select"
            name="order"
            value={filters.order}
            onChange={handleFilterChange}
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
        </div>
        <div className="col">
          <button className="btn btn-primary w-100" onClick={applyFilters}>
            Apply
          </button>
        </div>
      </div>

      {loading ? (
        <Spinner animation="border" />
      ) : (
        <ul className="list-group mt-3">
          {tasks.map((task) => (
            <li
              className="list-group-item d-flex justify-content-between align-items-center"
              key={task._id}
            >
              <div style={{ maxWidth: '70%' }}>
                <strong>{task.title}</strong> -{' '}
                {task.completed ? 'Completed' : 'Pending'}
                <br />
                <small>{task.description}</small>
                <br />
                <small>
                  Due:{' '}
                  {task.dueDate
                    ? new Date(task.dueDate).toLocaleDateString()
                    : 'N/A'}
                </small>
              </div>
              <div className="btn-group">
                <Button variant="success" size="sm" onClick={() => markCompleted(task._id)}>
                  Complete
                </Button>
                <Button variant="warning" size="sm" onClick={() => markPending(task._id)}>
                  Pending
                </Button>
                <Button variant="danger" size="sm" onClick={() => deleteTask(task._id)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <hr />
      <h3>Add a New Task</h3>
      <form onSubmit={handleAddTask} className="mb-4">
        <input
          className="form-control my-2"
          name="title"
          placeholder="Task Title"
          value={formData.title}
          onChange={handleFormChange}
          required
        />
        <input
          className="form-control my-2"
          name="description"
          placeholder="Task Description"
          value={formData.description}
          onChange={handleFormChange}
          required
        />
        <input
          className="form-control my-2"
          type="date"
          name="dueDate"
          value={formData.dueDate}
          onChange={handleFormChange}
          required
        />

        {/* Autocomplete for clientName */}
        <div className="position-relative my-2">
          <input
            className="form-control"
            name="clientName"
            placeholder="Client Name (optional)"
            value={formData.clientName}
            onChange={handleFormChange}
          />
          {formData.clientName && clientSuggestions.length > 0 && (
            <ul className="list-group position-absolute" style={{ width: '100%', zIndex: 10 }}>
              {clientSuggestions.map((c) => (
                <li
                  key={c._id}
                  className="list-group-item"
                  style={{ cursor: 'pointer' }}
                  onMouseDown={() => selectClientSuggestion(c.name)}
                >
                  {c.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button type="submit" className="btn btn-primary" disabled={adding}>
          Add Task
        </button>
      </form>
    </div>
  );
};

export default Tasks;
