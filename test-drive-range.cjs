async function test() {
  const folderId = '1K10tFckXEG_2IF4knfMaezexpulzYta2';
  const apiKey = process.env.GOOGLE_API_KEY;
  const listUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents&key=${apiKey}&fields=files(id,name)`;
  const res = await fetch(listUrl);
  const data = await res.json();
  const fileId = data.files[0].id;
  
  const res3 = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`, {
    headers: { 'Range': 'bytes=0-100' }
  });
  console.log('alt=media range status:', res3.status);
  if (res3.status !== 200 && res3.status !== 206) {
    console.log(await res3.text());
  }
}
test();
