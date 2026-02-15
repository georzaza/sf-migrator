import os, sys
import shutil
from pprint import pprint

# gets all .csv recursively
def listCsvFilesRecursively(path='.', filepaths=[]):
    for descriptor in os.listdir(path):
        relativePath = os.path.join(path, descriptor)
        fullpath = os.path.abspath(relativePath)
        if relativePath.endswith('.csv'):
            filepaths.append(fullpath)
        if os.path.isdir(relativePath):
            listCsvFilesRecursively(relativePath, filepaths)
    return filepaths

# files that may have been processed with a prior execution of this script
def filterOutProcessedFiles(paths):
    filtered = []
    for filename in paths:
        with open(filename, 'r',) as f:
            first_line = f.readline().strip('\n')
            if not first_line.startswith('sep='):
               filtered.append(filename)
            f.close()
    return filtered

# creates a copy of a csv by appending the sep=<DELIMITER>
def createCsvCopyWithSep(filepathToCopy, delimiter):
    newfilepath = filepathToCopy[0:filepathToCopy.find('.csv')]+'_with_sep'+delimiter+'.csv'
    shutil.copy(filepathToCopy, newfilepath)
    with open(newfilepath, 'r+') as f:
        _contents = f.read()
        f.seek(0)
        f.write('sep='+delimiter+'\n')
        f.flush()
        f.close()
    print('File created:', newfilepath)


DIRECTORY_PATH = '.'
DELIMITER = '$'


filepaths = listCsvFilesRecursively(DIRECTORY_PATH)
pprint('Filepaths below')
filesToProcess = filterOutProcessedFiles(filepaths)

for file in filesToProcess:
    filename = file[0:file.rindex(os.path.sep)] + file[file.rindex(os.path.sep):-4] + '.csv'
    newFilename = file[0:file.find('_with_sep')+9] + DELIMITER + '.csv'
    if len(sys.argv) == 2  and  sys.argv[1] == '-f':
        createCsvCopyWithSep(file, DELIMITER)
    else:
        if not os.path.exists(newFilename):
            createCsvCopyWithSep(file, DELIMITER)
        else:
            print('File exists. Either run with -f option or delete run the bash script to delete the file: ', filename)
