import asyncio
import httpx
import os

async def main():
    master_url = os.getenv("SEAWEEDFS_MASTER_URL", "http://10.37.91.104:29333")
    print(f"Assigning from {master_url}")
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(f"{master_url}/dir/assign")
        data = resp.json()
        print(f"Assign response: {data}")
        
        fid = data["fid"]
        
        url1 = data.get("url")
        url2 = data.get("publicUrl")
        
        # Test uploading a simple ASCII file
        v_url1 = f"http://{url1}/{fid}"
        print(f"Uploading to {v_url1}")
        try:
            files = {"file": ("test.txt", b"hello world", "text/plain")}
            r = await client.post(v_url1, files=files)
            print(f"Success to url {url1}:", r.status_code, r.text)
        except Exception as e:
            print(f"Error on url {url1}:", repr(e))
            
        # Test Chinese filename
        v_url2 = f"http://{url2}/{fid}"
        print(f"Uploading (Chinese filename) to {v_url2}")
        try:
            files2 = {"file": ("理想l9正面评论.xlsx", b"hello world", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            r = await client.post(v_url2, files=files2)
            print(f"Success with Chinese filename to url {url2}:", r.status_code, r.text)
        except Exception as e:
            print(f"Error with Chinese filename on url {url2}:", repr(e))

if __name__ == "__main__":
    asyncio.run(main())
