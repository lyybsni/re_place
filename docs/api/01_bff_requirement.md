# BFF requirement

## Overview
This project will be using Google Firebase for the infrastructural support, including authentication, database, and storage. This is under the next.js project and act as the server side coding.

## Authentication
Authentication will be handled by Firebase Authentication. The BFF will provide endpoints for user login, logout, and session management. It will also handle token verification and refresh.
Email login and login via Google are enabled.

### Tasks
1. Implement all the necessary endpoints for user authentication.
2. Ensure secure handling of user credentials and tokens.
3. Update the common header of the project to include user information and authentication status.
4. Implement session management to maintain user state across requests.

## Database

The database will be managed by Firebase Firestore. The BFF will provide endpoints for CRUD operations on the database. It will also handle data validation and access control.

### Tasks
1. Design the database schema to support the application's data requirements.
2. Implement endpoints for creating, reading, updating, and deleting data.
3. Ensure data validation and enforce access control rules.
4. Optimize database queries for performance and scalability.

## Storage

The storage will be managed by Firebase Storage. The BFF will provide endpoints for uploading and retrieving files. It will also handle file validation and access control.

### Tasks
1. Implement endpoints for uploading and retrieving files.
2. Ensure file validation and enforce access control rules.
3. Optimize file storage and retrieval for performance and scalability.