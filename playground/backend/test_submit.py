import asyncio
import httpx
import os

async def main():
    master_url = os.getenv("SEAWEEDFS_MASTER_URL", "http://10.37.91.104:29333")
    print(f"Submitting to {master_url}/submit")
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Try submit with Chinese
        try:
            files2 = {"file": ("理想l9正面评论.xlsx", b"hello world", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            r = await client.post(f"{master_url}/submit", files=files2)
            print("With Chinese:", r.status_code, r.text)
        except Exception as e:
            print("With Chinese failed:", repr(e))
            
        # Try submit with ASCII
        try:
            files_ascii = {"file": ("file.xlsx", b"hello world", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            r2 = await client.post(f"{master_url}/submit", files=files_ascii)
            print("With ASCII:", r2.status_code, r2.text)
        except Exception as e:
            print("With ASCII failed:", repr(e))

if __name__ == "__main__":
    asyncio.run(main())
