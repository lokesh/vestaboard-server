require('dotenv').config();

// READ FROM BOARD
// await fetch("https://rw.vestaboard.com/", {
//   headers: {
//     "Content-Type": "application/json",
//     "X-Vestaboard-Read-Write-Key": process.env.VESTABOARD_READ_WRITE_API_KEY,
//   },
//   method: "GET",
// }).then(async (res) => {
//   let data = await res.json();
//   console.log(data);
// });

// WRITE TO BOARD
// await fetch("https://rw.vestaboard.com/", {
//   body: JSON.stringify([
//     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//     [0, 0, 0, 0, 0, 8, 5, 12, 12, 15, 0, 23, 15, 18, 12, 4, 0, 0, 0, 0, 0, 0],
//     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
//   ]),
//   headers: {
//     "Content-Type": "application/json",
//     "X-Vestaboard-Read-Write-Key": process.env.VESTABOARD_READ_WRITE_API_KEY,
//   },
//   method: "POST",
// }).then((res) => res.json());

