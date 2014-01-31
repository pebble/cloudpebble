#include <sys/types.h>
#include <unistd.h>
#include <errno.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/resource.h>

// We can't easily get at our settings, so these are just hardcoded.
#define BUILD_JAIL "/home/cloudpebble/jail/"
#define error(message) error_f(__FILE__, __LINE__, message)
#define require(call) if(error(call)) return errno;

_Bool error_f(char* file, int line, int ret) {
    if(ret == -1) {
        printf("%s:%d: error: %s\n", file, line, strerror(errno));
        return 1;
    }
    return 0;
}

int set_limit(int resource, rlim_t value) {
    return setrlimit(resource, &(const struct rlimit){.rlim_cur = value, .rlim_max = value});
}

int main(int argc, char** argv) {
    if(argc < 3 || argc > 4) {
        printf("Requires three or four arguments.\n");
        return 0;
    }
    uid_t start_uid = getuid();
    if(start_uid == 0) {
        printf("Corwardly refusing to run as root.\n");
        return 1;
    }
    char optimise = '0';
    if(argc == 4) {
        optimise = argv[3][0];
    }
    char sdk = argv[1][0];
    require(setuid(0));
    require(chdir(BUILD_JAIL));
    require(chroot(BUILD_JAIL));
    require(setuid(start_uid));
    // We should now have no privileges and be jailed.
    // Impose some more limits:
    require(set_limit(RLIMIT_CPU, 10)); // Ten seconds
    require(set_limit(RLIMIT_NOFILE, 100)); // 100 open files
    require(set_limit(RLIMIT_RSS, 20 * 1024 * 1024)); // 20 MB of memory
    require(set_limit(RLIMIT_FSIZE, 5 * 1024 * 1024)); // 5 MB output files
    // Actually do the build.
    require(chdir(argv[2]));
    require(setenv("HOME", "/", 1));

    if(sdk == '1') {
        require(setenv("PATH", "/bin:/usr/bin:/sdk/arm-cs-tools/bin", 1));
        char final_command[] = "./waf configure -O 0";
        sprintf(final_command, "./waf configure -O %c", optimise);
        int success = system(final_command);
        if(success != 0) {
            return WEXITSTATUS(success);
        }
        success = system("./waf build");
        if(success != 0) {
            return WEXITSTATUS(success);
        }
    } else if(sdk == '2') {
        require(setenv("PATH", "/bin:/usr/bin:/sdk2/bin", 1));
        int success = system("pebble build");
        if(success != 0) {
            return WEXITSTATUS(success);
        }
    } else {
        printf("Unrecognised SDK version '%c'.\n", sdk);
        return 1;
    }
    return 0;
}
