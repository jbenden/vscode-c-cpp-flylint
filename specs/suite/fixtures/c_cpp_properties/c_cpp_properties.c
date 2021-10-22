#include <stdio>
#include <string>

int main(int argc, char* argv[]) {
    /**
     * Generates an input and send it to stdout,
     * takes one argument for the length of input
     *
     * generate_input [len]
     *
     */

    if (argc != 2) {
        printf("error: only 1 argument expected (%i given)\n", argc - 1);
    }

    int len = argv[1];

    return 0;
}
