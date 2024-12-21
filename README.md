# TaskMate

## Project Overview

TaskMate is a web application designed to help users manage tasks, clients, and invoices efficiently. It provides an intuitive interface for creating, editing, and tracking tasks and invoices, ensuring users can keep their workflow organized.

## Features

* **User Authentication**: Secure login and registration functionality.
* **Task Management**: Add, edit, delete, and update the status of tasks.
* **Client Management**: Manage client details and associate tasks and invoices with clients.
* **Invoice Management**: Create, sort, filter, and delete invoices.
* **Dynamic Filtering and Sorting**: Real-time filtering and sorting of tasks and invoices based on user-defined criteria.
* **Interactive Interface**: Responsive design for seamless user experience.

## Installation Instructions

1. **Clone the Repository**: Run the following command:
   ```bash
   git clone <https://github.com/jcsv1991/TaskMate>
   ```

2. **Navigate to Project Directories**: Navigate to the `backend` and `frontend` folders separately.

3. **Install Dependencies**: In both `backend` and `frontend` directories, run:
   ```bash
   npm install
   ```

4. **Set Up Environment Variables**: In the `backend` directory, create a `.env` file and include:
   ```
   PORT=5000
   MONGO_URI=<Your MongoDB Atlas connection string>
   JWT_SECRET=<Your JWT secret key>
   ```

5. **Start the Development Servers**:
   * For the backend:
     ```bash
     npm run dev
     ```
   * For the frontend:
     ```bash
     npm start
     ```

6. **Access the Application**: Open your browser and navigate to `http://localhost:3000` to use the application.

## Usage

1. Register as a new user or log in with an existing account.
2. Manage tasks by creating, editing, or deleting them through the task dashboard.
3. View and manage client details, including their associated tasks and invoices.
4. Create and organize invoices for clients.
5. Use filtering and sorting options to customize task and invoice views.

## Technologies Used

* **Frontend**: React.js, Vite, Material UI, Axios
* **Backend**: Node.js, Express.js
* **Database**: MongoDB (Atlas)
* **Authentication**: JSON Web Tokens (JWT)
* **Deployment**: Render (Backend), Netlify (Frontend)

## Future Improvements

* **Notifications**: Add reminders for overdue tasks and invoices.
* **Enhanced Reports**: Generate detailed reports for tasks and invoices.
* **Team Collaboration**: Introduce multi-user functionality for managing shared projects.
* **Mobile App**: Develop a mobile version for better accessibility.
* **Data Export**: Enable exporting data to CSV or PDF format for external usage.

This README provides a comprehensive overview of TaskMate and guides users on installation and usage.
