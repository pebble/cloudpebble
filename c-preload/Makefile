ifeq (FreeBSD,$(shell uname -s))
    LDL :=
else
    LDL := -ldl
endif

all: clean libpreload.so

libpreload.so: preload.c
	$(CC) -std=c99 -shared -O1 -fPIC $^ -o $@ $(LDL)

clean:
	rm -f libpreload.so
