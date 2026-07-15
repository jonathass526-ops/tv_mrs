async function test() {
  const fileId = '19YgkHZPlz6Zm9MtDKXvySi4g2Z_9c0dv';
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(url);
  console.log(res.status);
}
test();
