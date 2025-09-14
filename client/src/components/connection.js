linkServer = 'http://127.0.0.1:8000'

export async function submit(markers){
    const response = await fetch(`${linkServer}/find-optimal-location/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(markers)
    });
    return response;
}

export async function submitTest(markers){
    const response = await fetch(`${linkServer}/find-optimal-location-test/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(markers)
    });
    return response;
}