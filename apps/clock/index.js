import 'dotenv/config';
import { writeText } from '../../utils/index.js';

function getCurrentTime() {
    const options = {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    };
    
    const timeString = new Date().toLocaleTimeString('en-US', options);
    
    // Split time into hours and minutes/period
    const [time, period] = timeString.split(' ');
    const [hours] = time.split(':');
    
    // Add space before single-digit hours
    const formattedHours = parseInt(hours) < 10 ? ` ${hours}` : hours;
    
    // Reconstruct the time string
    return `${formattedHours}:${time.split(':')[1]} ${period}`;
}

const currentTime = getCurrentTime();
console.log(currentTime);

// WRITE TO BOARD
const response = await writeText(currentTime);

console.log(response);
