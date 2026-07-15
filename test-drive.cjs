async function test() {
  const folderId = '1K10tFckXEG_2IF4knfMaezexpulzYta2';
  const apiKey = process.env.GOOGLE_API_KEY;
  const listUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents&key=${apiKey}&fields=files(id,name)`;
  const res = await fetch(listUrl);
  const data = await res.json();
  console.log('files:', data);
  if (data.files && data.files.length > 0) {
    const fileId = data.files[0].id;
    console.log('fileId:', fileId);
    
    // test 1: drive.google.com/uc
    const res2 = await fetch(`https://drive.google.com/uc?export=download&id=${fileId}`);
    console.log('uc status:', res2.status, res2.headers.get('content-type'));

    // test 2: googleapis.com/drive/v3/files/...
    const res3 = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`);
    console.log('alt=media status:', res3.status);
    if (res3.status !== 200) {
      console.log(await res3.text());
    }
  }
}
test();
