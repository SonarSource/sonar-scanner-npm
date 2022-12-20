
import java.io.*;
import java.nio.*;
import java.nio.channels.*;


class stop {

    public static void main(String[] args) throws Exception {
           try (RandomAccessFile sharedMemory = new RandomAccessFile(new File(args[0], "temp/sharedmemory"), "rw")) {
      // Using values from org.sonar.process.ProcessCommands
      MappedByteBuffer mappedByteBuffer = sharedMemory.getChannel().map(FileChannel.MapMode.READ_WRITE, 0, 50L * 10);

      // Now we are stopping all processes as quick as possible
      // by asking for stop of "app" process
      mappedByteBuffer.put(1, (byte) 0xFF);
    }
    }
} 
