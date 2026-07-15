async function test() {
  const folderId = '1K10tFckXEG_2IF4knfMaezexpulzYta2';
  const apiKey = process.env.GOOGLE_API_KEY;
  const listUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents&key=${apiKey}&fields=files(id,name,webContentLink)`;
  const res = await fetch(listUrl);
  const data = await res.json();
  console.log(data.files[0]);
}
test();
