const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors')
const sendEmail = require('./sendmail')
const dotenv = require('dotenv')

const app = express();
app.use(cors())
app.use(express.json())
const port = 4000;
dotenv.config({ path: "./.env" })
// Database connection configuration
const pool = new Pool({
    user: 'user',
    password: 'pass',
    database: 'users',
    host: 'postgres',
    port: 5432,
    schema: 'public'
});


async function checkDatabaseConnection() {
    try {
        const client = await pool.connect();
        console.log('Connected to the database');
        client.release(); // Release the client back to the pool
    } catch (error) {
        console.error('Error connecting to the database:', error);
    }
}


checkDatabaseConnection();


function calculateCurrentWeek(registrationDate) {
    const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000; // Number of milliseconds in a week
    const currentDate = new Date();
    const timeDifference = currentDate - registrationDate;
    const weekDifference = Math.floor(timeDifference / millisecondsPerWeek);
    return weekDifference + 1; // Adding 1 to convert from zero-based index to one-based week number
}

// Register route
app.post('/register', async (req, res) => {
    const { name, phoneNumber, email, password } = req.body;

    try {
        // Check if the user already exists in the database
        const checkUserQuery = 'SELECT * FROM users WHERE email = $1';
        const checkUserValues = [email];
        const { rowCount } = await pool.query(checkUserQuery, checkUserValues);

        if (rowCount > 0) {
            return res.status(409).json({ error: 'User already registered' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user details into the users table
        const userQuery = 'INSERT INTO users (name, phoneNumber, email, password) VALUES ($1, $2, $3, $4) RETURNING id';
        const userValues = [name, phoneNumber, email, hashedPassword];
        const { rows } = await pool.query(userQuery, userValues);

        const userId = rows[0].id;

        // Insert default task values into the tasks table
        const registrationDate = new Date();
        const currentWeek = calculateCurrentWeek(registrationDate);

        const tasksQuery =
            'INSERT INTO tasks (userId, taskName, registrationDate, currentWeek) VALUES ($1, $2, $3, $4)';
        const tasksValues = [userId, 'Default Task', registrationDate, currentWeek];
        await pool.query(tasksQuery, tasksValues);

        res.status(200).json({ message: 'User registered successfully' });
        console.log("user regisrered")
    } catch (error) {
        console.error('Error occurred during registration:', error);
        res.status(500).json({ error: 'An internal server error occurred' });
    }
});


// ...

const activeUsers = new Map(); // Map to store active users' registration dates and current weeks

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find user by email
        const userQuery = 'SELECT * FROM users WHERE email = $1';
        const userValues = [email];
        const { rows } = await pool.query(userQuery, userValues);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = rows[0];

        // Compare passwords
        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        // Store registration date and current week in memory
        const registrationDate = user.registrationDate;
        console.log(registrationDate)
        const currentWeek = calculateCurrentWeek(registrationDate);
        activeUsers.set(user.id, { registrationDate, currentWeek });
        console.log(currentWeek)

        // Fetch user's tasks
        const tasksQuery = 'SELECT * FROM tasks WHERE userId = $1';
        const tasksValues = [user.id];
        const tasksResult = await pool.query(tasksQuery, tasksValues);
        const tasks = tasksResult.rows;
        console.log(tasks)


        res.status(200).json({ user, tasks });
    } catch (error) {
        console.error('Error occurred during login:', error);
        res.status(500).json({ error: 'An internal server error occurred' });
    }
});


// ...

app.post('/logout', async (req, res) => {
    const userId = req.user.id; // Assuming you have implemented user authentication

    try {
        // Update the database with the current week
        const currentWeek = calculateCurrentWeek(new Date());
        const updateQuery = 'UPDATE users SET currentWeek = $1 WHERE id = $2';
        const updateValues = [currentWeek, userId];
        await pool.query(updateQuery, updateValues);

        // Remove the user from activeUsers map
        activeUsers.delete(userId);

        res.status(200).json({ message: 'User logged out successfully' });
    } catch (error) {
        console.error('Error occurred during logout:', error);
        res.status(500).json({ error: 'An internal server error occurred' });
    }
});

// Function to calculate time remaining for the current week
function getRemainingTimeForWeek(registrationDate) {
    if (!registrationDate) {
        return 0; // or handle the case where registrationDate is undefined/null
    }

    const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000; // Number of milliseconds in a week
    const currentDate = new Date();
    const registrationWeek = Math.floor((currentDate - new Date(registrationDate)) / millisecondsPerWeek); // Calculate the registration week
    const currentWeek = Math.floor((currentDate - new Date('2023-01-01').getTime()) / millisecondsPerWeek) + 1; // Calculate the current week, add 1 to match the desired week numbering

    if (currentWeek > registrationWeek) {
        // If the current week is greater than the registration week, it means that a week has passed since registration
        registrationDate = new Date(new Date(registrationDate).getTime() + registrationWeek * millisecondsPerWeek); // Reset the registration date to the start of the current week
    }

    const currentDay = currentDate.getDay(); // Get the current day of the week (0 = Sunday, 6 = Saturday)
    const endOfWeek = new Date(registrationDate.getTime() + (7 - currentDay) * 24 * 60 * 60 * 1000); // Calculate the end of the current week
    const timeRemaining = endOfWeek.getTime() - currentDate.getTime(); // Calculate the time remaining in milliseconds

    return timeRemaining;
}


getUserdate = async (id) => {
    const userQuery = 'SELECT * FROM tasks WHERE id = $1';
    const userValues = [id];
    const result = await pool.query(userQuery, userValues);
    const { registrationDate } = result.rows[0];
    console.log(registrationDate)
    return registrationDate
}



app.get('/stream/:userId', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const intervalId = setInterval(async () => {
        const userId = req.params.userId;
        console.log(userId)

        const registrationDate = await getUserdate(userId); // Assuming you have implemented user authentication and registration date is stored in the database
        console.log(registrationDate)
        const timeRemaining = getRemainingTimeForWeek(registrationDate);

        // Check if the week has reset
        if (timeRemaining <= 0) {
            clearInterval(intervalId); // Clear the current interval
            // Optionally, you can update the registration date and restart the SSE here
        }

        console.log(timeRemaining)
        res.write(`data: ${JSON.stringify({ timeRemaining })}\n\n`);
    }, 1000); // Update the SSE every second

    req.socket.on('close', () => {
        clearInterval(intervalId);
    });
});

const MailSend = async (req, res) => {
    try {
        sendEmail(req.body);
        res.send("Email Sent");
    } catch (err) {
        console.log(err)
        res.send(err)
    }

}

app.post('/sendemail', MailSend);

app.post('/update', async (req, res) => {
    try {
        const { id, currentWeek, count } = req.body;

        // Construct the column name for the current week
        const weekColumnName = `week${currentWeek}`;

        // Update the count value for the given id and current week column
        const updateQuery = `UPDATE tasks SET ${weekColumnName} = $1 WHERE id = $2`;
        const updateValues = [count, id];
        await pool.query(updateQuery, updateValues);

        res.status(200).json({ success: true, message: 'Count updated successfully' });
    } catch (error) {
        console.error('Error updating count:', error);
        res.status(500).json({ success: false, message: 'Failed to update count' });
    }
});



app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
// ...


// ...

