async function test() {
  const fileId = '19YgkHZPlz6Zm9MtDKXvySi4g2Z_9c0dv';
  const res = await fetch(`https://drive.google.com/uc?export=view&id=${fileId}`);
  console.log(res.status, res.headers.get('content-type'));
}
test();
