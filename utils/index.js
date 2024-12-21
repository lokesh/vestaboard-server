import 'dotenv/config';

export async function readLayout() {
  return fetch("https://rw.vestaboard.com/", {
    headers: {
      "Content-Type": "application/json",
      "X-Vestaboard-Read-Write-Key": process.env.VESTABOARD_READ_WRITE_API_KEY,
    },
    method: "GET",
  }).then(async (res) => {
    let data = await res.json();
    return data.currentMessage.layout;
  });
}

export async function writeLayout(layout) {
  return fetch("https://rw.vestaboard.com/", {
    body: JSON.stringify(layout),
    headers: {
      "Content-Type": "application/json",
      "X-Vestaboard-Read-Write-Key": process.env.VESTABOARD_READ_WRITE_API_KEY,
    },
    method: "POST",
  }).then((res) => res.json());
}

export async function writeText(text) {
  return fetch("https://rw.vestaboard.com/", {
    body: JSON.stringify({ text }),
    headers: {
      "Content-Type": "application/json",
      "X-Vestaboard-Read-Write-Key": process.env.VESTABOARD_READ_WRITE_API_KEY,
    },
    method: "POST",
  }).then((res) => res.json());
}


