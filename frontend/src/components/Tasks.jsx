import React, { useEffect, useState } from 'react';
import API from '../services/api';

const Tasks = () => {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await API.get('/tasks');
        setTasks(res.data);
      } catch (err) {
        console.error('Error fetching tasks:', err);
      }
    };

    fetchTasks();
  }, []);

  return (
    <div className="container mt-4">
      <h2>Your Tasks</h2>
      <ul>
        {tasks.map((task) => (
          <li key={task._id}>
            {task.title} - {task.completed ? "Completed" : "Pending"}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Tasks;
