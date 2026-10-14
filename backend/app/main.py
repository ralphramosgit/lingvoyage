from fastapi import FastAPI
from mangum import Mangum

app = FastAPI(title="Naviglot API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


handler = Mangum(app, lifespan="off")
