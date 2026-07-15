async function test() {
  const fileId = '1EBZH813HCO1lT03t4MiF2Qds2gqj5NUS';
  const res = await fetch(`https://drive.google.com/uc?export=view&id=${fileId}`);
  console.log(res.status, res.headers.get('content-type'));
}
test();
