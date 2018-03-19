export function isError(error) {
    const str = error.toString();
    return str.includes('revert'); //|| str.includes('invalid opcode');
}

export function assertError(error) {
    assert.isTrue(isError(error));
}
